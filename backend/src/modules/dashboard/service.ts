import { z } from "zod";
import { hasGlobalScope, hasPermission } from "../../config/permissions.js";
import { toObjectId } from "../../database/connection.js";
import {
  clientScope,
  leadScope,
  projectScope,
  proposalScope,
  taskScope,
} from "../../services/scope.service.js";
import type { Actor } from "../../types/express.js";
import { RANGE_PRESETS } from "../../utils/dates.js";
import { populateNamed, populateUser } from "../../utils/query.js";
import { Activity } from "../activities/model.js";
import { Client } from "../clients/model.js";
import { Invoice } from "../invoices/model.js";
import { Lead } from "../leads/model.js";
import { Project } from "../projects/model.js";
import { progressOf } from "../projects/service.js";
import { Proposal } from "../proposals/model.js";
import {
  collectedByCurrency,
  dayBucket,
  invoicedByCurrency,
  mergeFinancials,
  outstandingByCurrency,
  revenueByService,
  revenueOverTime,
} from "../reports/aggregations.js";
import { rangeFrom } from "../reports/service.js";
import { Task } from "../tasks/model.js";

export const dashboardQuerySchema = z.object({
  preset: z.enum(RANGE_PRESETS).default("this_month"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

const CLOSED_STAGES = ["WON", "LOST"];
const TERMINAL_PROJECT = ["COMPLETED", "CANCELLED", "DELIVERED"];
const OPEN_TASK = { $in: ["TODO", "IN_PROGRESS"] };

/** Sections are built only for what the role may see, so restricted figures are never sent at all. */
export async function getDashboard(actor: Actor, query: z.infer<typeof dashboardQuerySchema>) {
  const { range, timezone } = await rangeFrom(query);
  const now = new Date();
  const inRange = { $gte: range.from, $lt: range.to };
  const can = (permission: Parameters<typeof hasPermission>[1]) =>
    hasPermission(actor.role, permission);

  const leadSection = async () => {
    const base = { $and: [leadScope(actor), { archivedAt: null }] };
    const period = { $and: [...base.$and, { createdAt: inRange }] };
    const group = (field: string) =>
      Lead.aggregate<{ key: string; count: number }>([
        { $match: period },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        {
          $project: {
            _id: 0,
            key: { $cond: [{ $in: ["$_id", [null, ""]] }, "Unspecified", "$_id"] },
            count: 1,
          },
        },
      ]);
    const [
      total,
      newInRange,
      active,
      overdueFollowUps,
      overTime,
      bySource,
      byCountry,
      recent,
      upcoming,
    ] = await Promise.all([
      Lead.countDocuments(base),
      Lead.countDocuments(period),
      Lead.countDocuments({ $and: [...base.$and, { status: { $nin: CLOSED_STAGES } }] }),
      Lead.countDocuments({
        $and: [
          ...base.$and,
          { status: { $nin: CLOSED_STAGES } },
          { nextFollowUpAt: { $lt: now, $ne: null } },
        ],
      }),
      Lead.aggregate<{ period: string; count: number }>([
        { $match: period },
        {
          $group: {
            _id: { $dateToString: { date: "$createdAt", format: dayBucket(range), timezone } },
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, period: "$_id", count: 1 } },
        { $sort: { period: 1 } },
      ]),
      group("source"),
      group("country"),
      Lead.find(base)
        .select("fullName companyName country status createdAt")
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Lead.find({
        $and: [
          ...base.$and,
          { status: { $nin: CLOSED_STAGES } },
          { nextFollowUpAt: { $ne: null } },
        ],
      })
        .select("fullName companyName nextFollowUpAt timezone")
        .sort({ nextFollowUpAt: 1 })
        .limit(5)
        .lean(),
    ]);
    return {
      total,
      newInRange,
      active,
      overdueFollowUps,
      overTime,
      bySource,
      byCountry,
      recent,
      upcomingFollowUps: upcoming,
    };
  };

  const clientSection = async () => {
    const scope = await clientScope(actor);
    const [total, active] = await Promise.all([
      Client.countDocuments({ $and: [scope, { status: { $ne: "ARCHIVED" } }] }),
      Client.countDocuments({ $and: [scope, { status: "ACTIVE" }] }),
    ]);
    return { total, active };
  };

  const projectSection = async () => {
    const base = { $and: [projectScope(actor), { archivedAt: null }] };
    const [active, completed, statusDistribution, activeList] = await Promise.all([
      Project.countDocuments({ $and: [...base.$and, { status: { $nin: TERMINAL_PROJECT } }] }),
      Project.countDocuments({ $and: [...base.$and, { status: "COMPLETED" }] }),
      Project.aggregate<{ key: string; count: number }>([
        { $match: base },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { _id: 0, key: "$_id", count: 1 } },
        { $sort: { count: -1 } },
      ]),
      Project.find({ $and: [...base.$and, { status: { $nin: TERMINAL_PROJECT } }] })
        .select("name code status expectedDeliveryDate")
        .sort({ expectedDeliveryDate: 1 })
        .limit(5)
        .populate(populateNamed("client", "name"))
        .lean(),
    ]);
    const list = await Promise.all(
      activeList.map(async (p) => ({ ...p, progress: (await progressOf(p._id)).progress })),
    );
    return { active, completed, statusDistribution, activeList: list };
  };

  const taskSection = async () => {
    const base = { $and: [taskScope(actor), { deletedAt: null }, { status: OPEN_TASK }] };
    const [pending, overdue, upcoming] = await Promise.all([
      Task.countDocuments(base),
      Task.countDocuments({ $and: [...base.$and, { dueAt: { $lt: now, $ne: null } }] }),
      Task.find({ $and: [...base.$and, { dueAt: { $ne: null } }] })
        .select("title dueAt priority")
        .sort({ dueAt: 1 })
        .limit(5)
        .lean(),
    ]);
    return { pending, overdue, upcoming };
  };

  const proposalSection = async () => {
    const scope = proposalScope(actor);
    const base = { $and: [scope, { archivedAt: null }] };
    const [sent, accepted] = await Promise.all([
      Proposal.countDocuments({ $and: [...base.$and, { sentAt: inRange }] }),
      Proposal.countDocuments({
        $and: [...base.$and, { sentAt: inRange }, { status: "ACCEPTED" }],
      }),
    ]);
    return { sent, accepted, conversionRate: sent ? Math.round((accepted / sent) * 1000) / 10 : 0 };
  };

  const financeSection = async () => {
    const [invoiced, collected, outstanding, overTime, byService, openInvoices] = await Promise.all(
      [
        invoicedByCurrency(range),
        collectedByCurrency(range),
        outstandingByCurrency(),
        revenueOverTime(range, timezone),
        revenueByService(range),
        Invoice.find({
          archivedAt: null,
          amountDue: { $gt: 0 },
          status: { $nin: ["DRAFT", "CANCELLED"] },
        })
          .select("number currency amountDue dueDate status client")
          .sort({ dueDate: 1 })
          .limit(5)
          .populate(populateNamed("client", "name"))
          .lean(),
      ],
    );
    return {
      byCurrency: mergeFinancials(invoiced, collected, outstanding),
      revenueOverTime: overTime,
      revenueByService: byService,
      openInvoices,
    };
  };

  const activities = () =>
    Activity.find(hasGlobalScope(actor.role) ? {} : { actor: toObjectId(actor.id) })
      .select("action description occurredAt actor entityType entityId")
      .sort({ occurredAt: -1 })
      .limit(10)
      .populate(populateUser("actor"))
      .lean();

  const [leads, clients, projects, tasks, proposals, finance, recentActivities] = await Promise.all(
    [
      can("lead:read") ? leadSection() : null,
      can("client:read") ? clientSection() : null,
      can("project:read") ? projectSection() : null,
      can("task:read") ? taskSection() : null,
      can("proposal:read") ? proposalSection() : null,
      can("invoice:read") ? financeSection() : null,
      can("activity:read") ? activities() : [],
    ],
  );

  return { range, leads, clients, projects, tasks, proposals, finance, recentActivities };
}
