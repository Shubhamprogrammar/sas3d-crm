import type { PipelineStage } from "mongoose";
import { z } from "zod";
import { hasGlobalScope } from "../../config/permissions.js";
import { toObjectId } from "../../database/connection.js";
import { leadScope, opportunityScope } from "../../services/scope.service.js";
import type { Actor } from "../../types/express.js";
import { RANGE_PRESETS, resolveRange } from "../../utils/dates.js";
import { conversionRate } from "../opportunities/transitions.js";
import { Lead } from "../leads/model.js";
import { Opportunity } from "../opportunities/model.js";
import { Invoice } from "../invoices/model.js";
import { Payment } from "../payments/model.js";
import { Project, ProjectTask } from "../projects/model.js";
import { getCompanyTimezone } from "../settings/service.js";
import { Task } from "../tasks/model.js";
import { User } from "../users/model.js";
import {
  collectedByCurrency,
  dayBucket,
  invoicedByCurrency,
  mergeFinancials,
  outstandingByCurrency,
  revenueByClient,
  revenueByService,
  revenueOverTime,
} from "./aggregations.js";

export const rangeQuerySchema = z.object({
  preset: z.enum(RANGE_PRESETS).default("this_year"),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  format: z.enum(["json", "csv"]).default("json"),
});
export type RangeQuery = z.infer<typeof rangeQuerySchema>;

const TERMINAL_PROJECT = ["COMPLETED", "CANCELLED", "DELIVERED"] as const;

export async function rangeFrom(query: Pick<RangeQuery, "preset" | "from" | "to">) {
  const timezone = await getCompanyTimezone();
  return { timezone, range: resolveRange(query.preset, timezone, query) };
}

const countBy = (field: string, match: Record<string, unknown>, limit = 50): PipelineStage[] => [
  { $match: match },
  { $group: { _id: `$${field}`, count: { $sum: 1 } } },
  { $sort: { count: -1 } },
  { $limit: limit },
  {
    $project: {
      _id: 0,
      key: { $cond: [{ $in: ["$_id", [null, ""]] }, "Unspecified", "$_id"] },
      count: 1,
    },
  },
];

export async function salesReport(actor: Actor, query: RangeQuery) {
  const { range, timezone } = await rangeFrom(query);
  const inRange = { createdAt: { $gte: range.from, $lt: range.to } };
  const leadMatch = { $and: [leadScope(actor), { archivedAt: null }, inRange] };
  const oppScope = opportunityScope(actor);

  const [generated, bySource, byCountry, monthly, converted, won, lost, lostReasons] =
    await Promise.all([
      Lead.countDocuments(leadMatch),
      Lead.aggregate<{ key: string; count: number }>(countBy("source", leadMatch)),
      Lead.aggregate<{ key: string; count: number }>(countBy("country", leadMatch)),
      Lead.aggregate<{ period: string; count: number }>([
        { $match: leadMatch },
        {
          $group: {
            _id: { $dateToString: { date: "$createdAt", format: dayBucket(range), timezone } },
            count: { $sum: 1 },
          },
        },
        { $project: { _id: 0, period: "$_id", count: 1 } },
        { $sort: { period: 1 } },
      ]),
      Lead.countDocuments({
        $and: [leadScope(actor), { convertedAt: { $gte: range.from, $lt: range.to } }],
      }),
      Opportunity.countDocuments({
        ...oppScope,
        archivedAt: null,
        stage: "WON",
        wonAt: { $gte: range.from, $lt: range.to },
      }),
      Opportunity.countDocuments({
        ...oppScope,
        archivedAt: null,
        stage: "LOST",
        lostAt: { $gte: range.from, $lt: range.to },
      }),
      Opportunity.aggregate<{ key: string; count: number }>(
        countBy("lostReason", {
          ...oppScope,
          archivedAt: null,
          stage: "LOST",
          lostAt: { $gte: range.from, $lt: range.to },
        }),
      ),
    ]);
  return {
    range,
    leadsGenerated: generated,
    converted,
    won,
    lost,
    winRate: conversionRate(won, lost),
    bySource,
    byCountry,
    monthly,
    lostReasons,
  };
}

export async function financeReport(query: RangeQuery) {
  const { range, timezone } = await rangeFrom(query);
  const [invoiced, collected, outstanding, monthly, byService, byClient, payments, openInvoices] =
    await Promise.all([
      invoicedByCurrency(range),
      collectedByCurrency(range),
      outstandingByCurrency(),
      revenueOverTime(range, timezone),
      revenueByService(range),
      revenueByClient(range),
      Payment.find({ voidedAt: null, paymentDate: { $gte: range.from, $lt: range.to } })
        .sort({ paymentDate: -1 })
        .limit(200)
        .populate("invoice", "number")
        .populate("client", "name")
        .lean(),
      Invoice.find({
        archivedAt: null,
        amountDue: { $gt: 0 },
        status: { $nin: ["DRAFT", "CANCELLED"] },
      })
        .sort({ dueDate: 1 })
        .limit(200)
        .select("number client currency total amountDue dueDate status")
        .populate("client", "name")
        .lean(),
    ]);
  return {
    range,
    financials: mergeFinancials(invoiced, collected, outstanding),
    monthly,
    byService,
    byClient,
    payments,
    openInvoices,
  };
}

export async function projectsReport(query: RangeQuery) {
  const { range } = await rangeFrom(query);
  const now = new Date();
  const [active, completed, delayed, delivered, byStatus] = await Promise.all([
    Project.countDocuments({ archivedAt: null, status: { $nin: TERMINAL_PROJECT } }),
    Project.countDocuments({
      archivedAt: null,
      status: "COMPLETED",
      actualCompletionDate: { $gte: range.from, $lt: range.to },
    }),
    Project.find({
      archivedAt: null,
      status: { $nin: TERMINAL_PROJECT },
      expectedDeliveryDate: { $lt: now, $ne: null },
    } as Record<string, unknown>)
      .select("name code status expectedDeliveryDate" as string)
      .sort({ expectedDeliveryDate: 1 })
      .limit(100)
      .populate("client", "name")
      .populate("projectManager", "name")
      .lean(),
    Project.find({
      archivedAt: null,
      actualCompletionDate: { $gte: range.from, $lt: range.to },
      expectedDeliveryDate: { $ne: null },
    } as Record<string, unknown>)
      .select("expectedDeliveryDate actualCompletionDate" as string)
      .lean(),
    Project.aggregate<{ key: string; count: number }>(countBy("status", { archivedAt: null })),
  ]);
  const onTime = delivered.filter(
    (p) =>
      p.actualCompletionDate &&
      p.expectedDeliveryDate &&
      p.actualCompletionDate <= p.expectedDeliveryDate,
  ).length;
  return {
    range,
    active,
    completed,
    delayedCount: delayed.length,
    delayed,
    byStatus,
    delivery: {
      measured: delivered.length,
      onTime,
      late: delivered.length - onTime,
      onTimeRate: delivered.length ? Math.round((onTime / delivered.length) * 100) : 0,
    },
  };
}

export async function teamReport(actor: Actor, query: RangeQuery) {
  const { range } = await rangeFrom(query);
  const now = new Date();
  const taskMatch =
    hasGlobalScope(actor.role) || actor.role === "PROJECT_MANAGER"
      ? {}
      : { assignedTo: toObjectId(actor.id) };
  const tally = (dueField: string) => ({
    assigned: { $sum: 1 },
    completed: {
      $sum: {
        $cond: [
          {
            $and: [
              { $eq: ["$status", "COMPLETED"] },
              { $gte: ["$completedAt", range.from] },
              { $lt: ["$completedAt", range.to] },
            ],
          },
          1,
          0,
        ],
      },
    },
    pending: { $sum: { $cond: [{ $in: ["$status", ["TODO", "IN_PROGRESS"]] }, 1, 0] } },
    overdue: {
      $sum: {
        $cond: [
          {
            $and: [
              { $in: ["$status", ["TODO", "IN_PROGRESS"]] },
              { $ne: [`$${dueField}`, null] },
              { $lt: [`$${dueField}`, now] },
            ],
          },
          1,
          0,
        ],
      },
    },
  });
  const rows = await Task.aggregate<{
    _id: unknown;
    assigned: number;
    completed: number;
    pending: number;
    overdue: number;
  }>([
    { $match: { deletedAt: null, assignedTo: { $ne: null }, ...taskMatch } },
    { $group: { _id: "$assignedTo", ...tally("dueAt") } },
  ]);
  const projectRows = await ProjectTask.aggregate<{
    _id: unknown;
    assigned: number;
    completed: number;
    pending: number;
    overdue: number;
  }>([
    { $match: { assignedTo: { $ne: null }, ...taskMatch } },
    { $group: { _id: "$assignedTo", ...tally("dueDate") } },
  ]);
  const merged = new Map<
    string,
    { assigned: number; completed: number; pending: number; overdue: number }
  >();
  for (const row of [...rows, ...projectRows]) {
    const key = String(row._id);
    const current = merged.get(key) ?? { assigned: 0, completed: 0, pending: 0, overdue: 0 };
    merged.set(key, {
      assigned: current.assigned + row.assigned,
      completed: current.completed + row.completed,
      pending: current.pending + row.pending,
      overdue: current.overdue + row.overdue,
    });
  }
  const users = await User.find({ _id: { $in: [...merged.keys()] } })
    .select("name role")
    .lean();
  return {
    range,
    members: users
      .map((user) => ({
        id: user._id,
        name: user.name,
        role: user.role,
        ...merged.get(String(user._id)),
      }))
      .sort((a, b) => (b.pending ?? 0) - (a.pending ?? 0)),
  };
}
