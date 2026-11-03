import { Router, type Response } from "express";
import { stringify } from "csv-stringify/sync";
import { actorOf, requirePermission as can } from "../../middleware/auth.js";
import { audit } from "../../services/audit.service.js";
import { csvSafe } from "../../utils/csv.js";
import { sendCsv, sendOk } from "../../utils/http.js";
import { minorToDecimal } from "../../utils/money.js";
import * as reports from "./service.js";

type Row = (string | number)[];

const toCsv = (sections: { title: string; header: string[]; rows: Row[] }[]) =>
  sections
    .map((section) =>
      stringify([[section.title], section.header, ...section.rows.map((row) => row.map(csvSafe))]),
    )
    .join("\n");

const respond = (
  res: Response,
  format: string,
  filename: string,
  data: unknown,
  sections: () => Parameters<typeof toCsv>[0],
) => {
  if (format === "csv") return sendCsv(res, filename, toCsv(sections()));
  return sendOk(res, data);
};

const counts = (rows: { key: string; count: number }[]): Row[] =>
  rows.map((row) => [row.key, row.count]);
const name = (value: unknown) => (value as { name?: string } | null)?.name ?? "";
const iso = (value: unknown) => (value instanceof Date ? value.toISOString().slice(0, 10) : "");

export const reportRoutes = Router();

reportRoutes.get("/sales", can("report:sales"), async (req, res) => {
  const query = reports.rangeQuerySchema.parse(req.query);
  const data = await reports.salesReport(actorOf(req), query);
  respond(res, query.format, "sales-report.csv", data, () => [
    {
      title: "Summary",
      header: ["Metric", "Value"],
      rows: [
        ["Leads generated", data.leadsGenerated],
        ["Converted to clients", data.converted],
        ["Won", data.won],
        ["Lost", data.lost],
        ["Win rate %", data.winRate],
      ],
    },
    { title: "Leads by source", header: ["Source", "Leads"], rows: counts(data.bySource) },
    { title: "Leads by country", header: ["Country", "Leads"], rows: counts(data.byCountry) },
    { title: "Lost reasons", header: ["Reason", "Count"], rows: counts(data.lostReasons) },
  ]);
});

reportRoutes.get("/finance", can("report:finance"), async (req, res) => {
  const query = reports.rangeQuerySchema.parse(req.query);
  const data = await reports.financeReport(query);
  if (query.format === "csv")
    await audit(actorOf(req), {
      action: "report.export",
      entityType: "Report",
      summary: "finance",
    });
  respond(res, query.format, "finance-report.csv", data, () => [
    {
      title: "Totals by currency",
      header: ["Currency", "Invoiced", "Collected", "Outstanding"],
      rows: data.financials.map((row) => [
        row.currency,
        minorToDecimal(row.invoiced),
        minorToDecimal(row.collected),
        minorToDecimal(row.outstanding),
      ]),
    },
    {
      title: "Revenue over time",
      header: ["Period", "Currency", "Collected"],
      rows: data.monthly.map((row) => [row.period, row.currency, minorToDecimal(row.amount)]),
    },
    {
      title: "Revenue by service",
      header: ["Service", "Currency", "Invoiced"],
      rows: data.byService.map((row) => [row.service, row.currency, minorToDecimal(row.amount)]),
    },
    {
      title: "Revenue by client",
      header: ["Client", "Currency", "Invoiced", "Outstanding"],
      rows: data.byClient.map((row) => [
        row.client,
        row.currency,
        minorToDecimal(row.invoiced),
        minorToDecimal(row.outstanding),
      ]),
    },
    {
      title: "Payments received",
      header: ["Date", "Invoice", "Client", "Currency", "Amount", "Method", "Reference"],
      rows: data.payments.map((p) => [
        iso(p.paymentDate),
        (p.invoice as unknown as { number?: string })?.number ?? "",
        name(p.client),
        p.currency,
        minorToDecimal(p.amount),
        p.method,
        p.transactionReference ?? "",
      ]),
    },
    {
      title: "Outstanding invoices",
      header: ["Invoice", "Client", "Currency", "Due", "Due date", "Status"],
      rows: data.openInvoices.map((i) => [
        i.number,
        name(i.client),
        i.currency,
        minorToDecimal(i.amountDue ?? 0),
        iso(i.dueDate),
        i.status,
      ]),
    },
  ]);
});

reportRoutes.get("/projects", can("report:projects"), async (req, res) => {
  const query = reports.rangeQuerySchema.parse(req.query);
  const data = await reports.projectsReport(query);
  respond(res, query.format, "projects-report.csv", data, () => [
    {
      title: "Summary",
      header: ["Metric", "Value"],
      rows: [
        ["Active", data.active],
        ["Completed in period", data.completed],
        ["Delayed", data.delayedCount],
        ["On-time rate %", data.delivery.onTimeRate],
      ],
    },
    { title: "Projects by status", header: ["Status", "Projects"], rows: counts(data.byStatus) },
    {
      title: "Delayed projects",
      header: ["Code", "Project", "Client", "Manager", "Status", "Expected delivery"],
      rows: data.delayed.map((p) => [
        p.code,
        p.name,
        name(p.client),
        name(p.projectManager),
        p.status,
        iso(p.expectedDeliveryDate),
      ]),
    },
  ]);
});

reportRoutes.get("/team", can("report:team"), async (req, res) => {
  const query = reports.rangeQuerySchema.parse(req.query);
  const data = await reports.teamReport(actorOf(req), query);
  respond(res, query.format, "team-report.csv", data, () => [
    {
      title: "Workload",
      header: ["Member", "Role", "Assigned", "Completed in period", "Pending", "Overdue"],
      rows: data.members.map((m) => [
        m.name,
        m.role ?? "",
        m.assigned ?? 0,
        m.completed ?? 0,
        m.pending ?? 0,
        m.overdue ?? 0,
      ]),
    },
  ]);
});
