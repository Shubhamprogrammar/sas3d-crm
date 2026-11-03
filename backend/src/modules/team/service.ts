import type { z } from "zod";
import { provisionUser, revokeAllSessions } from "../../config/auth.js";
import type { Role } from "../../config/constants.js";
import { canManageRole } from "../../config/permissions.js";
import { toObjectId } from "../../database/connection.js";
import { audit } from "../../services/audit.service.js";
import { assertFound } from "../../services/scope.service.js";
import type { Actor } from "../../types/express.js";
import { AppError } from "../../utils/http.js";
import { paginate, populateNamed, searchFilter } from "../../utils/query.js";
import { Lead } from "../leads/model.js";
import { Project, ProjectTask } from "../projects/model.js";
import { Task } from "../tasks/model.js";
import { User } from "../users/model.js";
import type { createMemberSchema, listTeamSchema, updateMemberSchema } from "./validator.js";

const PUBLIC_FIELDS = "name email phone image role status designation joiningDate skills createdAt";

export function listTeam(query: z.infer<typeof listTeamSchema>) {
  return paginate(
    User,
    {
      $and: [
        searchFilter(["name", "email", "designation"], query.search),
        ...(query.role ? [{ role: query.role }] : []),
        ...(query.status ? [{ status: query.status }] : []),
      ],
    },
    { page: query.page, limit: query.limit, sort: { name: 1 }, select: PUBLIC_FIELDS },
  );
}

export async function getMember(id: string) {
  const user = assertFound(await User.findById(id).select(PUBLIC_FIELDS).lean(), "Team member");
  const objectId = toObjectId(id);
  const open = { $in: ["TODO", "IN_PROGRESS"] as ("TODO" | "IN_PROGRESS")[] };
  const [leads, projects, crmOpen, crmDone, projectOpen, projectDone, recentTasks] =
    await Promise.all([
      Lead.find({ assignedTo: objectId, archivedAt: null })
        .select("fullName companyName status")
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
      Project.find({ $or: [{ team: objectId }, { projectManager: objectId }], archivedAt: null })
        .select("name code status")
        .sort({ createdAt: -1 })
        .limit(25)
        .lean(),
      Task.countDocuments({ assignedTo: objectId, deletedAt: null, status: open }),
      Task.countDocuments({ assignedTo: objectId, deletedAt: null, status: "COMPLETED" }),
      ProjectTask.countDocuments({ assignedTo: objectId, status: open }),
      ProjectTask.countDocuments({ assignedTo: objectId, status: "COMPLETED" }),
      Task.find({ assignedTo: objectId, deletedAt: null, status: open })
        .select("title dueAt priority status")
        .sort({ dueAt: 1 })
        .limit(25)
        .populate(populateNamed("project", "name"))
        .lean(),
    ]);
  const completed = crmDone + projectDone;
  const pending = crmOpen + projectOpen;
  return {
    ...user,
    leads,
    projects,
    tasks: recentTasks,
    stats: {
      pendingTasks: pending,
      completedTasks: completed,
      completionRate:
        completed + pending === 0 ? 0 : Math.round((completed / (completed + pending)) * 100),
    },
  };
}

function assertCanManage(actor: Actor, targetRole: Role) {
  if (!canManageRole(actor.role, targetRole)) {
    throw AppError.forbidden("You cannot manage users with this role");
  }
}

async function assertNotLastSuperAdmin(target: {
  _id: unknown;
  role?: string | null;
  status?: string | null;
}) {
  if (target.role !== "SUPER_ADMIN" || target.status !== "ACTIVE") return;
  const others = await User.countDocuments({
    role: "SUPER_ADMIN",
    status: "ACTIVE",
    _id: { $ne: target._id },
  });
  if (others === 0) throw AppError.conflict("This is the last active Super Admin");
}

export async function createMember(actor: Actor, input: z.infer<typeof createMemberSchema>) {
  assertCanManage(actor, input.role);
  if (await User.exists({ email: input.email }))
    throw AppError.conflict("A user with this email already exists");
  const { name, email, password, role, ...extra } = input;
  const created = await provisionUser({ name, email, password, role, extra });
  await audit(actor, {
    action: "team.create",
    entityType: "User",
    entityId: created.id,
    summary: `${email} as ${role}`,
  });
  return User.findById(created.id).select(PUBLIC_FIELDS).lean();
}

export async function updateMember(
  actor: Actor,
  id: string,
  input: z.infer<typeof updateMemberSchema>,
) {
  const user = assertFound(await User.findById(id), "Team member");
  assertCanManage(actor, user.role as Role);
  if (input.role && input.role !== user.role) {
    assertCanManage(actor, input.role);
    if (input.role !== "SUPER_ADMIN") await assertNotLastSuperAdmin(user);
  }
  if (input.email && input.email !== user.email && (await User.exists({ email: input.email }))) {
    throw AppError.conflict("A user with this email already exists");
  }
  const before = { role: user.role };
  user.set(input);
  await user.save();
  await audit(actor, {
    action: input.role && input.role !== before.role ? "team.role_change" : "team.update",
    entityType: "User",
    entityId: user._id,
    summary: user.email,
    before,
    after: { role: user.role },
  });
  return User.findById(id).select(PUBLIC_FIELDS).lean();
}

export async function setMemberStatus(actor: Actor, id: string, status: "ACTIVE" | "INACTIVE") {
  const user = assertFound(await User.findById(id), "Team member");
  assertCanManage(actor, user.role as Role);
  if (status === "INACTIVE") {
    if (String(user._id) === actor.id)
      throw AppError.conflict("You cannot deactivate your own account");
    await assertNotLastSuperAdmin(user);
  }
  user.status = status;
  await user.save();
  if (status === "INACTIVE") await revokeAllSessions(id);
  await audit(actor, {
    action: status === "ACTIVE" ? "team.activate" : "team.deactivate",
    entityType: "User",
    entityId: user._id,
    summary: user.email,
  });
  return User.findById(id).select(PUBLIC_FIELDS).lean();
}
