import { Invoice } from "../invoices/model.js";
import { Payment } from "../payments/model.js";

export interface Range {
  from: Date;
  to: Date;
}

/** Issued invoices only: a draft has no financial effect and a cancelled one no longer counts. */
const ISSUED = { archivedAt: null, status: { $nin: ["DRAFT", "CANCELLED"] } };

export const dayBucket = (range: Range) =>
  range.to.getTime() - range.from.getTime() <= 62 * 24 * 60 * 60 * 1000 ? "%Y-%m-%d" : "%Y-%m";

export const invoicedByCurrency = (range: Range) =>
  Invoice.aggregate<{ currency: string; invoiced: number; count: number }>([
    { $match: { ...ISSUED, issueDate: { $gte: range.from, $lt: range.to } } },
    { $group: { _id: "$currency", invoiced: { $sum: "$total" }, count: { $sum: 1 } } },
    { $project: { _id: 0, currency: "$_id", invoiced: 1, count: 1 } },
    { $sort: { currency: 1 } },
  ]);

export const collectedByCurrency = (range: Range) =>
  Payment.aggregate<{ currency: string; collected: number; count: number }>([
    { $match: { voidedAt: null, paymentDate: { $gte: range.from, $lt: range.to } } },
    { $group: { _id: "$currency", collected: { $sum: "$amount" }, count: { $sum: 1 } } },
    { $project: { _id: 0, currency: "$_id", collected: 1, count: 1 } },
    { $sort: { currency: 1 } },
  ]);

/** Current balance, not period-bound: money owed today regardless of when it was invoiced. */
export const outstandingByCurrency = () =>
  Invoice.aggregate<{ currency: string; outstanding: number; count: number }>([
    { $match: { ...ISSUED, amountDue: { $gt: 0 } } },
    { $group: { _id: "$currency", outstanding: { $sum: "$amountDue" }, count: { $sum: 1 } } },
    { $project: { _id: 0, currency: "$_id", outstanding: 1, count: 1 } },
    { $sort: { currency: 1 } },
  ]);

export const revenueOverTime = (range: Range, timezone: string) =>
  Payment.aggregate<{ period: string; currency: string; amount: number }>([
    { $match: { voidedAt: null, paymentDate: { $gte: range.from, $lt: range.to } } },
    {
      $group: {
        _id: {
          period: { $dateToString: { date: "$paymentDate", format: dayBucket(range), timezone } },
          currency: "$currency",
        },
        amount: { $sum: "$amount" },
      },
    },
    { $project: { _id: 0, period: "$_id.period", currency: "$_id.currency", amount: 1 } },
    { $sort: { period: 1, currency: 1 } },
  ]);

/** Based on invoiced line amounts before document-level discount and tax. */
export const revenueByService = (range: Range) =>
  Invoice.aggregate<{ service: string; currency: string; amount: number }>([
    { $match: { ...ISSUED, issueDate: { $gte: range.from, $lt: range.to } } },
    { $unwind: "$items" },
    {
      $group: {
        _id: { service: "$items.service", currency: "$currency" },
        amount: { $sum: "$items.amount" },
      },
    },
    {
      $lookup: { from: "services", localField: "_id.service", foreignField: "_id", as: "service" },
    },
    {
      $project: {
        _id: 0,
        service: { $ifNull: [{ $first: "$service.name" }, "Not linked to a service"] },
        currency: "$_id.currency",
        amount: 1,
      },
    },
    { $sort: { amount: -1 } },
  ]);

export const revenueByClient = (range: Range) =>
  Invoice.aggregate<{ client: string; currency: string; invoiced: number; outstanding: number }>([
    { $match: { ...ISSUED, issueDate: { $gte: range.from, $lt: range.to } } },
    {
      $group: {
        _id: { client: "$client", currency: "$currency" },
        invoiced: { $sum: "$total" },
        outstanding: { $sum: "$amountDue" },
      },
    },
    { $lookup: { from: "clients", localField: "_id.client", foreignField: "_id", as: "client" } },
    {
      $project: {
        _id: 0,
        client: { $ifNull: [{ $first: "$client.name" }, "Unknown"] },
        currency: "$_id.currency",
        invoiced: 1,
        outstanding: 1,
      },
    },
    { $sort: { invoiced: -1 } },
    { $limit: 100 },
  ]);

/** Merges per-currency figures for display, always keeping each currency on its own row. */
export function mergeFinancials(
  invoiced: { currency: string; invoiced: number }[],
  collected: { currency: string; collected: number }[],
  outstanding: { currency: string; outstanding: number }[],
) {
  const currencies = [
    ...new Set([...invoiced, ...collected, ...outstanding].map((row) => row.currency)),
  ].sort();
  return currencies.map((currency) => ({
    currency,
    invoiced: invoiced.find((row) => row.currency === currency)?.invoiced ?? 0,
    collected: collected.find((row) => row.currency === currency)?.collected ?? 0,
    outstanding: outstanding.find((row) => row.currency === currency)?.outstanding ?? 0,
  }));
}
