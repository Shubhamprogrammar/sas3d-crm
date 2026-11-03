import type { z } from "zod";
import { toObjectId, withTransaction } from "../../database/connection.js";
import { logActivity } from "../../services/activity.service.js";
import { audit } from "../../services/audit.service.js";
import { notify } from "../../services/notification.service.js";
import {
  assertFound,
  clientScope,
  leadScope,
  projectScope,
  taskScope,
} from "../../services/scope.service.js";
import type { Actor } from "../../types/express.js";
import { paginate, populateNamed, populateUser, searchFilter } from "../../utils/query.js";
import { startOfDayInZone } from "../../utils/dates.js";
import { Client } from "../clients/model.js";
import { Lead } from "../leads/model.js";
import { Project } from "../projects/model.js";
import { getCompanyTimezone } from "../settings/service.js";
import { Task } from "./model.js";
import type { createTaskSchema, listTasksSchema, updateTaskSchema } from "./validator.js";

const POPULATE = [
  populateUser("assignedTo"),
  populateNamed("lead", "fullName"),
  populateNamed("client", "name"),
  populateNamed("project", "name code"),
];
const OPEN = { $in: ["TODO", "IN_PROGRESS"] };

/** Stops a task from being attached to (and thereby revealing) a record the actor cannot see. */
async function assertRelatedAccess(
  actor: Actor,
  input: { lead?: string | null; client?: string | null; project?: string | null },
) {
  if (input.lead)
    assertFound(await Lead.exists({ $and: [{ _id: input.lead }, leadScope(actor)] }), "Lead");
  if (input.client)
    assertFound(
      await Client.exists({ $and: [{ _id: input.client }, await clientScope(actor)] }),
      "Client",
    );
  if (input.project)
    assertFound(
      await Project.exists({ $and: [{ _id: input.project }, projectScope(actor)] }),
      "Project",
    );
}

export async function listTasks(actor: Actor, query: z.infer<typeof listTasksSchema>) {
  const now = new Date();
  const startOfToday = startOfDayInZone(now, await getCompanyTimezone());
  const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

  const viewFilter: Record<string, Record<string, unknown>> = {
    today: { status: OPEN, dueAt: { $gte: startOfToday, $lt: endOfToday } },
    upcoming: { status: OPEN, dueAt: { $gte: endOfToday } },
    overdue: { status: OPEN, dueAt: { $lt: now, $ne: null } },
  };

  return paginate(
    Task,
    {
      $and: [
        taskScope(actor),
        { deletedAt: null },
        searchFilter(["title", "description"], query.search),
        query.view ? (viewFilter[query.view] ?? {}) : {},
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.priority ? [{ priority: query.priority }] : []),
        ...(query.assignedTo ? [{ assignedTo: toObjectId(query.assignedTo) }] : []),
        ...(query.lead ? [{ lead: toObjectId(query.lead) }] : []),
        ...(query.client ? [{ client: toObjectId(query.client) }] : []),
        ...(query.project ? [{ project: toObjectId(query.project) }] : []),
        ...(query.from || query.to
          ? [
              {
                dueAt: {
                  ...(query.from ? { $gte: query.from } : {}),
                  ...(query.to ? { $lte: query.to } : {}),
                },
              },
            ]
          : []),
      ],
    },
    {
      page: query.page,
      limit: query.limit,
      sort: { [query.sortBy ?? "dueAt"]: query.sortOrder === "desc" && query.sortBy ? -1 : 1 },
      populate: POPULATE,
    },
  );
}

const findScoped = async (actor: Actor, id: string) =>
  assertFound(
    await Task.findOne({ $and: [{ _id: id, deletedAt: null }, taskScope(actor)] }),
    "Task",
  );

export async function getTask(actor: Actor, id: string) {
  const task = await findScoped(actor, id);
  await task.populate(POPULATE);
  return task;
}

const notifyAssignee = (task: { _id: unknown; title: string; assignedTo?: unknown }) =>
  notify({
    recipient: String(task.assignedTo),
    type: "TASK_ASSIGNED",
    title: "Task assigned to you",
    message: task.title,
    link: "/tasks",
    entityType: "TASK",
    entityId: String(task._id),
  });

export async function createTask(actor: Actor, input: z.infer<typeof createTaskSchema>) {
  await assertRelatedAccess(actor, input);
  const task = await Task.create({
    assignedTo: actor.id,
    ...input,
    createdBy: actor.id,
    updatedBy: actor.id,
    ...(input.status === "COMPLETED" ? { completedAt: new Date(), completedBy: actor.id } : {}),
  });
  await logActivity(actor, {
    action: "task.created",
    description: `Task "${task.title}" created`,
    entityType: "TASK",
    entityId: task._id,
    lead: task.lead,
    client: task.client,
    project: task.project,
  });
  if (task.assignedTo && String(task.assignedTo) !== actor.id) await notifyAssignee(task);
  return task;
}

export async function updateTask(
  actor: Actor,
  id: string,
  input: z.infer<typeof updateTaskSchema>,
) {
  await assertRelatedAccess(actor, input);
  return withTransaction(async (session) => {
    const task = assertFound(
      await Task.findOne({ $and: [{ _id: id, deletedAt: null }, taskScope(actor)] }).session(
        session,
      ),
      "Task",
    );
    const wasCompleted = task.status === "COMPLETED";
    const previousAssignee = task.assignedTo ? String(task.assignedTo) : null;
    task.set({ ...input, updatedBy: actor.id });

    if (task.status === "COMPLETED" && !wasCompleted) {
      task.completedAt = new Date();
      task.completedBy = toObjectId(actor.id);
      await logActivity(
        actor,
        {
          action: "task.completed",
          description: `Task "${task.title}" completed`,
          entityType: "TASK",
          entityId: task._id,
          lead: task.lead,
          client: task.client,
          project: task.project,
        },
        session,
      );
    } else if (task.status !== "COMPLETED") {
      task.completedAt = null;
      task.completedBy = null;
    }
    await task.save({ session });

    const assignee = task.assignedTo ? String(task.assignedTo) : null;
    if (assignee && assignee !== previousAssignee && assignee !== actor.id) {
      await notify(
        {
          recipient: assignee,
          type: "TASK_ASSIGNED",
          title: "Task assigned to you",
          message: task.title,
          link: "/tasks",
          entityType: "TASK",
          entityId: task._id,
        },
        session,
      );
    }
    return task;
  });
}

export async function deleteTask(actor: Actor, id: string) {
  const task = await findScoped(actor, id);
  task.deletedAt = new Date();
  await task.save();
  await audit(actor, {
    action: "task.delete",
    entityType: "Task",
    entityId: task._id,
    summary: task.title,
  });
}
