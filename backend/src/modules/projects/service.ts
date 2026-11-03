import type { ClientSession, Types } from "mongoose";
import type { z } from "zod";
import { hasGlobalScope } from "../../config/permissions.js";
import { toObjectId, withTransaction } from "../../database/connection.js";
import { logActivity } from "../../services/activity.service.js";
import { audit } from "../../services/audit.service.js";
import { notify, notifyMany } from "../../services/notification.service.js";
import { nextProjectCode } from "../../services/numbering.service.js";
import { assertFound, clientScope, projectScope } from "../../services/scope.service.js";
import type { Actor } from "../../types/express.js";
import { AppError } from "../../utils/http.js";
import { paginate, populateNamed, populateUser, searchFilter } from "../../utils/query.js";
import { Client } from "../clients/model.js";
import { Milestone, Project, ProjectTask, ProjectUpdate } from "./model.js";
import { calculateProgress } from "./progress.js";
import type {
  CreateProjectInput,
  createMilestoneSchema,
  createProjectTaskSchema,
  createUpdateSchema,
  listProjectsSchema,
  updateMilestoneSchema,
  updateProjectSchema,
  updateProjectTaskSchema,
} from "./validator.js";

const LIST_POPULATE = [
  populateNamed("client", "name companyName country"),
  populateUser("projectManager"),
  populateUser("team"),
];

/** A project's progress across all its milestones and tasks. */
export async function progressOf(projectId: Types.ObjectId | string) {
  const [milestones, tasks] = await Promise.all([
    Milestone.find({ project: projectId }).select("status").lean(),
    ProjectTask.find({ project: projectId }).select("status").lean(),
  ]);
  return {
    progress: calculateProgress([...milestones, ...tasks] as { status: string }[]),
    milestoneCount: milestones.length,
    milestonesCompleted: milestones.filter((m) => m.status === "COMPLETED").length,
    taskCount: tasks.length,
    tasksCompleted: tasks.filter((t) => t.status === "COMPLETED").length,
  };
}

export async function listProjects(actor: Actor, query: z.infer<typeof listProjectsSchema>) {
  const result = await paginate(
    Project,
    {
      $and: [
        projectScope(actor),
        { archivedAt: null },
        searchFilter(["name", "code"], query.search),
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.priority ? [{ priority: query.priority }] : []),
        ...(query.client ? [{ client: toObjectId(query.client) }] : []),
        ...(query.projectManager ? [{ projectManager: toObjectId(query.projectManager) }] : []),
      ],
    },
    {
      page: query.page,
      limit: query.limit,
      sort: { [query.sortBy ?? "createdAt"]: query.sortOrder === "asc" ? 1 : -1 },
      populate: LIST_POPULATE,
      select: "-internalNotes",
    },
  );
  const items = await Promise.all(
    result.items.map(async (project) => ({ ...project, ...(await progressOf(project._id)) })),
  );
  return { items, meta: result.meta };
}

async function findScoped(actor: Actor, id: Types.ObjectId | string, session?: ClientSession) {
  const project = await Project.findOne({
    $and: [{ _id: id, archivedAt: null }, projectScope(actor)],
  }).session(session ?? null);
  return assertFound(project, "Project");
}
export const assertProjectAccess = findScoped;

/** Project changes need the role permission and, below admin level, being that project's manager. */
function assertCanManage(actor: Actor, project: { projectManager?: unknown }) {
  if (hasGlobalScope(actor.role)) return;
  if (actor.role === "PROJECT_MANAGER" && String(project.projectManager) === actor.id) return;
  throw AppError.forbidden("Only this project's manager can make that change");
}

export async function getProject(actor: Actor, id: string) {
  const project = await findScoped(actor, id);
  await project.populate(LIST_POPULATE);
  return { ...project.toObject(), ...(await progressOf(project._id)) };
}

export async function createProjectInTx(
  actor: Actor,
  input: CreateProjectInput & { opportunity?: string },
  session: ClientSession,
) {
  const [project] = await Project.create(
    [
      {
        projectManager: actor.role === "PROJECT_MANAGER" ? actor.id : null,
        ...input,
        code: await nextProjectCode(session),
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    ],
    { session },
  );
  if (!project) throw new Error("Project was not created");
  await logActivity(
    actor,
    {
      action: "project.created",
      description: `Project ${project.name} (${project.code}) created`,
      entityType: "PROJECT",
      entityId: project._id,
      project: project._id,
      client: project.client,
    },
    session,
  );
  await audit(
    actor,
    {
      action: "project.create",
      entityType: "Project",
      entityId: project._id,
      summary: project.code,
    },
    session,
  );
  await notifyMany(
    [project.projectManager, ...project.team].filter((id) => id && String(id) !== actor.id),
    {
      type: "PROJECT_STATUS_UPDATED",
      title: "You were added to a project",
      message: project.name,
      link: `/projects/${project._id}`,
      entityType: "PROJECT",
      entityId: project._id,
    },
    session,
  );
  return project;
}

export async function createProject(actor: Actor, input: CreateProjectInput) {
  const client = await Client.findOne({ $and: [{ _id: input.client }, await clientScope(actor)] })
    .select("_id")
    .lean();
  assertFound(client, "Client");
  return withTransaction((session) => createProjectInTx(actor, input, session));
}

export async function updateProject(
  actor: Actor,
  id: string,
  input: z.infer<typeof updateProjectSchema>,
) {
  return withTransaction(async (session) => {
    const project = await findScoped(actor, id, session);
    assertCanManage(actor, project);
    const previousStatus = project.status;
    project.set({ ...input, updatedBy: actor.id });
    if (project.status === "COMPLETED" && !project.actualCompletionDate)
      project.actualCompletionDate = new Date();
    await project.save({ session });

    if (input.status && input.status !== previousStatus) {
      await logActivity(
        actor,
        {
          action: "project.status_changed",
          description: `${project.name} moved from ${previousStatus} to ${project.status}`,
          entityType: "PROJECT",
          entityId: project._id,
          project: project._id,
          client: project.client,
        },
        session,
      );
      await notifyMany(
        [project.projectManager, ...project.team].filter(
          (member) => member && String(member) !== actor.id,
        ),
        {
          type: "PROJECT_STATUS_UPDATED",
          title: `Project status: ${project.status.replaceAll("_", " ")}`,
          message: project.name,
          link: `/projects/${project._id}`,
          entityType: "PROJECT",
          entityId: project._id,
        },
        session,
      );
    }
    await audit(
      actor,
      {
        action: "project.update",
        entityType: "Project",
        entityId: project._id,
        summary: project.code,
      },
      session,
    );
    return project;
  });
}

export async function archiveProject(actor: Actor, id: string) {
  const project = await findScoped(actor, id);
  project.archivedAt = new Date();
  await project.save();
  await audit(actor, {
    action: "project.archive",
    entityType: "Project",
    entityId: project._id,
    summary: project.code,
  });
  return project;
}

/* Milestones */

export async function listMilestones(actor: Actor, projectId: string) {
  await findScoped(actor, projectId);
  return Milestone.find({ project: projectId }).sort({ dueDate: 1, createdAt: 1 }).lean();
}

export async function createMilestone(actor: Actor, input: z.infer<typeof createMilestoneSchema>) {
  const project = await findScoped(actor, input.project);
  assertCanManage(actor, project);
  const milestone = await Milestone.create({
    ...input,
    completedAt: input.status === "COMPLETED" ? new Date() : null,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  await logActivity(actor, {
    action: "milestone.created",
    description: `Milestone "${milestone.title}" added to ${project.name}`,
    entityType: "PROJECT",
    entityId: project._id,
    project: project._id,
    client: project.client,
  });
  return milestone;
}

export async function updateMilestone(
  actor: Actor,
  id: string,
  input: z.infer<typeof updateMilestoneSchema>,
) {
  const milestone = assertFound(await Milestone.findById(id), "Milestone");
  const project = await findScoped(actor, milestone.project);
  assertCanManage(actor, project);
  const wasCompleted = milestone.status === "COMPLETED";
  milestone.set({ ...input, updatedBy: actor.id });
  if (milestone.status === "COMPLETED" && !wasCompleted) milestone.completedAt = new Date();
  if (milestone.status !== "COMPLETED") milestone.completedAt = null;
  await milestone.save();
  if (milestone.status === "COMPLETED" && !wasCompleted) {
    await logActivity(actor, {
      action: "milestone.completed",
      description: `Milestone "${milestone.title}" completed`,
      entityType: "PROJECT",
      entityId: project._id,
      project: project._id,
      client: project.client,
    });
  }
  return milestone;
}

export async function deleteMilestone(actor: Actor, id: string) {
  const milestone = assertFound(await Milestone.findById(id), "Milestone");
  assertCanManage(actor, await findScoped(actor, milestone.project));
  await withTransaction(async (session) => {
    // Tasks outlive the milestone: only their grouping goes away.
    await ProjectTask.updateMany({ milestone: id }, { $set: { milestone: null } }, { session });
    await milestone.deleteOne({ session });
  });
  await audit(actor, {
    action: "milestone.delete",
    entityType: "Milestone",
    entityId: milestone._id,
    summary: milestone.title,
  });
}

/* Project tasks */

export async function listProjectTasks(actor: Actor, projectId: string) {
  await findScoped(actor, projectId);
  return ProjectTask.find({ project: projectId })
    .sort({ createdAt: 1 })
    .limit(1000)
    .populate(populateUser("assignedTo"))
    .lean();
}

export async function createProjectTask(
  actor: Actor,
  input: z.infer<typeof createProjectTaskSchema>,
) {
  const project = await findScoped(actor, input.project);
  assertCanManage(actor, project);
  if (input.parentTask) {
    const parent = await ProjectTask.exists({
      _id: input.parentTask,
      project: input.project,
      parentTask: null,
    });
    if (!parent)
      throw AppError.badRequest(
        "Subtasks can only be added under a top-level task of the same project",
      );
  }
  const task = await ProjectTask.create({ ...input, createdBy: actor.id, updatedBy: actor.id });
  if (task.assignedTo && String(task.assignedTo) !== actor.id) {
    await notify({
      recipient: task.assignedTo,
      type: "TASK_ASSIGNED",
      title: "New project task assigned",
      message: `${task.title} (${project.name})`,
      link: `/projects/${project._id}`,
      entityType: "PROJECT",
      entityId: project._id,
    });
  }
  return task;
}

export async function updateProjectTask(
  actor: Actor,
  id: string,
  input: z.infer<typeof updateProjectTaskSchema>,
) {
  const task = assertFound(await ProjectTask.findById(id), "Task");
  const project = await findScoped(actor, task.project);
  const manages = hasGlobalScope(actor.role) || String(project.projectManager) === actor.id;

  if (!manages) {
    // Developers may only report progress on tasks assigned to them.
    if (String(task.assignedTo) !== actor.id)
      throw AppError.forbidden("You can only update tasks assigned to you");
    const disallowed = Object.keys(input).filter(
      (key) => key !== "status" && key !== "description",
    );
    if (disallowed.length)
      throw AppError.forbidden("You can only change the status and notes of this task");
  }

  const wasCompleted = task.status === "COMPLETED";
  const previousAssignee = task.assignedTo ? String(task.assignedTo) : null;
  task.set({ ...input, updatedBy: actor.id });
  task.completedAt = task.status === "COMPLETED" ? (task.completedAt ?? new Date()) : null;
  await task.save();

  if (task.status === "COMPLETED" && !wasCompleted) {
    await logActivity(actor, {
      action: "project_task.completed",
      description: `Task "${task.title}" completed`,
      entityType: "PROJECT",
      entityId: project._id,
      project: project._id,
      client: project.client,
    });
  }
  const assignee = task.assignedTo ? String(task.assignedTo) : null;
  if (assignee && assignee !== previousAssignee && assignee !== actor.id) {
    await notify({
      recipient: assignee,
      type: "TASK_ASSIGNED",
      title: "Project task assigned to you",
      message: `${task.title} (${project.name})`,
      link: `/projects/${project._id}`,
      entityType: "PROJECT",
      entityId: project._id,
    });
  }
  return task;
}

export async function deleteProjectTask(actor: Actor, id: string) {
  const task = assertFound(await ProjectTask.findById(id), "Task");
  assertCanManage(actor, await findScoped(actor, task.project));
  await ProjectTask.deleteMany({ $or: [{ _id: id }, { parentTask: id }] });
  await audit(actor, {
    action: "project_task.delete",
    entityType: "ProjectTask",
    entityId: task._id,
    summary: task.title,
  });
}

/* Updates, work notes and client feedback */

export async function listUpdates(actor: Actor, projectId: string, page: number, limit: number) {
  await findScoped(actor, projectId);
  return paginate(
    ProjectUpdate,
    { project: toObjectId(projectId) },
    { page, limit, populate: [populateUser("author")] },
  );
}

export async function addUpdate(
  actor: Actor,
  projectId: string,
  input: z.infer<typeof createUpdateSchema>,
) {
  const project = await findScoped(actor, projectId);
  const update = await ProjectUpdate.create({ ...input, project: project._id, author: actor.id });
  await logActivity(actor, {
    action: "project.update_added",
    description: `${update.type === "CLIENT_FEEDBACK" ? "Client feedback" : update.type === "WORK_NOTE" ? "Work note" : "Update"} added to ${project.name}`,
    entityType: "PROJECT",
    entityId: project._id,
    project: project._id,
    client: project.client,
  });
  return update;
}
