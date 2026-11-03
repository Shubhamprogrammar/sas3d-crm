import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { Lead } from "../modules/leads/model.js";
import { Invoice } from "../modules/invoices/model.js";
import { statusFor } from "../modules/invoices/service.js";
import { Milestone, Project } from "../modules/projects/model.js";
import { Proposal } from "../modules/proposals/model.js";
import { getCompanyTimezone } from "../modules/settings/service.js";
import { JobLock } from "../modules/settings/model.js";
import { Task } from "../modules/tasks/model.js";
import { User } from "../modules/users/model.js";
import { logActivity } from "./activity.service.js";
import { audit } from "./audit.service.js";
import { notify, notifyMany } from "./notification.service.js";
import { isPastDue } from "../utils/dates.js";

const HOUR = 60 * 60 * 1000;
const key = (date: Date | null | undefined) => date?.getTime() ?? 0;

/** Each reminder's dedupe key includes the due time, so rescheduling legitimately re-notifies. */
export async function remindFollowUps(now = new Date()) {
  const soon = new Date(now.getTime() + 24 * HOUR);
  const leads = await Lead.find({
    archivedAt: null,
    status: { $nin: ["WON", "LOST"] },
    nextFollowUpAt: { $ne: null, $lte: soon },
    assignedTo: { $ne: null },
  })
    .select("fullName assignedTo nextFollowUpAt")
    .lean();

  for (const lead of leads) {
    const overdue = lead.nextFollowUpAt! < now;
    await notify({
      recipient: lead.assignedTo,
      type: overdue ? "FOLLOW_UP_OVERDUE" : "FOLLOW_UP_DUE",
      title: overdue ? "Follow-up overdue" : "Follow-up due soon",
      message: lead.fullName,
      link: `/leads/${lead._id}`,
      entityType: "LEAD",
      entityId: lead._id,
      dedupeKey: `${overdue ? "lead-overdue" : "lead-due"}:${lead._id}:${key(lead.nextFollowUpAt)}`,
    });
  }
}

export async function remindTasks(now = new Date()) {
  const soon = new Date(now.getTime() + 24 * HOUR);
  const tasks = await Task.find({
    deletedAt: null,
    status: { $in: ["TODO", "IN_PROGRESS"] },
    dueAt: { $ne: null, $lte: soon },
    assignedTo: { $ne: null },
  })
    .select("title assignedTo dueAt")
    .lean();

  for (const task of tasks) {
    const overdue = task.dueAt! < now;
    await notify({
      recipient: task.assignedTo,
      type: overdue ? "FOLLOW_UP_OVERDUE" : "TASK_DEADLINE",
      title: overdue ? "Task overdue" : "Task deadline approaching",
      message: task.title,
      link: `/tasks?task=${task._id}`,
      entityType: "TASK",
      entityId: task._id,
      dedupeKey: `${overdue ? "task-overdue" : "task-due"}:${task._id}:${key(task.dueAt)}`,
    });
  }
}

export async function remindMilestones(now = new Date()) {
  const soon = new Date(now.getTime() + 72 * HOUR);
  const milestones = await Milestone.find({
    status: { $in: ["PENDING", "IN_PROGRESS"] },
    dueDate: { $ne: null, $gte: now, $lte: soon },
  })
    .select("title project dueDate")
    .lean();

  for (const milestone of milestones) {
    const project = await Project.findOne({ _id: milestone.project, archivedAt: null })
      .select("name projectManager team")
      .lean();
    if (!project) continue;
    await notifyMany([project.projectManager, ...project.team], {
      type: "MILESTONE_APPROACHING",
      title: "Milestone approaching",
      message: `${milestone.title} (${project.name})`,
      link: `/projects/${project._id}`,
      entityType: "PROJECT",
      entityId: project._id,
      dedupeKey: `milestone:${milestone._id}:${key(milestone.dueDate)}`,
    });
  }
}

export async function markOverdueInvoices(now = new Date()) {
  const timezone = await getCompanyTimezone();
  const candidates = await Invoice.find({
    archivedAt: null,
    // OVERDUE is included because an invoice issued after its due date starts in that state.
    status: { $in: ["SENT", "PARTIALLY_PAID", "OVERDUE"] },
    amountDue: { $gt: 0 },
    dueDate: { $lt: now },
  });
  const financeTeam = await User.find({
    role: { $in: ["FINANCE", "SUPER_ADMIN"] },
    status: "ACTIVE",
  })
    .select("_id")
    .lean();

  let marked = 0;
  for (const invoice of candidates) {
    if (!isPastDue(invoice.dueDate, timezone, now)) continue;
    if (invoice.status !== "OVERDUE") {
      invoice.status = statusFor(invoice, timezone, now) as typeof invoice.status;
      await invoice.save();
      marked += 1;
      await logActivity(null, {
        action: "invoice.overdue",
        description: `Invoice ${invoice.number} is overdue`,
        entityType: "INVOICE",
        entityId: invoice._id,
        client: invoice.client,
        project: invoice.project,
      });
      await audit(null, {
        action: "invoice.overdue",
        entityType: "Invoice",
        entityId: invoice._id,
        summary: invoice.number,
        after: { status: "OVERDUE" },
      });
    }
    await notifyMany([invoice.createdBy, ...financeTeam.map((u) => u._id)], {
      type: "INVOICE_OVERDUE",
      title: "Invoice overdue",
      message: invoice.number,
      link: `/invoices/${invoice._id}`,
      entityType: "INVOICE",
      entityId: invoice._id,
      dedupeKey: `invoice-overdue:${invoice._id}:${key(invoice.dueDate)}`,
    });
  }
  return marked;
}

export async function expireProposals(now = new Date()) {
  const proposals = await Proposal.find({
    archivedAt: null,
    status: { $in: ["SENT", "VIEWED"] },
    validUntil: { $ne: null, $lt: now },
  });
  for (const proposal of proposals) {
    proposal.status = "EXPIRED";
    await proposal.save();
    await logActivity(null, {
      action: "proposal.expired",
      description: `Proposal ${proposal.number} expired`,
      entityType: "PROPOSAL",
      entityId: proposal._id,
      client: proposal.client,
      lead: proposal.lead,
    });
  }
  return proposals.length;
}

const JOB_ID = "scheduled-maintenance";

/** The lock's expiry guards against a crashed instance holding it forever. */
async function acquireLock(now: Date, ttlMs: number) {
  try {
    const lock = await JobLock.findOneAndUpdate(
      { _id: JOB_ID, lockedUntil: { $lt: now } },
      { $set: { lockedUntil: new Date(now.getTime() + ttlMs), lastRunAt: now } },
      { upsert: true, returnDocument: "after", strict: false },
    );
    return Boolean(lock);
  } catch (error) {
    // Duplicate key: another instance holds the lock, so the upsert could not match.
    if ((error as { code?: number }).code === 11000) return false;
    throw error;
  }
}

export async function runScheduledJobs(now = new Date()) {
  if (!(await acquireLock(now, env.JOB_INTERVAL_SECONDS * 900))) return false;
  for (const job of [
    markOverdueInvoices,
    expireProposals,
    remindFollowUps,
    remindTasks,
    remindMilestones,
  ]) {
    try {
      await job(now);
    } catch (error) {
      // One failing job must not block the reminders behind it.
      logger.error({ err: error, job: job.name }, "Scheduled job failed");
    }
  }
  return true;
}

export async function lastJobRuns() {
  const lock = await JobLock.collection.findOne({ _id: JOB_ID as never });
  return {
    enabled: env.JOBS_ENABLED,
    intervalSeconds: env.JOB_INTERVAL_SECONDS,
    lastRunAt: lock?.lastRunAt ?? null,
  };
}

export function startScheduler() {
  if (!env.JOBS_ENABLED) return () => undefined;
  const run = () =>
    runScheduledJobs().catch((error) => logger.error({ err: error }, "Scheduler failed"));
  void run();
  const timer = setInterval(run, env.JOB_INTERVAL_SECONDS * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
