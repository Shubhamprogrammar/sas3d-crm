import type { z } from "zod";
import type { InvoiceStatus } from "../../config/constants.js";
import { toObjectId, withTransaction } from "../../database/connection.js";
import { logActivity } from "../../services/activity.service.js";
import { audit } from "../../services/audit.service.js";
import { sendEmail } from "../../services/email.service.js";
import { nextDocumentNumber } from "../../services/numbering.service.js";
import { invoicePdf } from "../../services/pdf.service.js";
import { assertFound } from "../../services/scope.service.js";
import type { Actor } from "../../types/express.js";
import { isPastDue } from "../../utils/dates.js";
import { AppError } from "../../utils/http.js";
import { calculateTotals, type DiscountInput } from "../../utils/money.js";
import { paginate, populateNamed, populateUser, searchFilter } from "../../utils/query.js";
import { Client } from "../clients/model.js";
import { Payment } from "../payments/model.js";
import { getCompanySettings, getCompanyTimezone } from "../settings/service.js";
import { deriveInvoiceStatus } from "./balance.js";
import { Invoice } from "./model.js";
import type { createInvoiceSchema, listInvoicesSchema, updateInvoiceSchema } from "./validator.js";

const POPULATE = [
  populateNamed("client", "name companyName email country"),
  populateNamed("project", "name code"),
];

function withTotals<
  T extends {
    items: { quantity: number; unitPrice: number }[];
    discount?: DiscountInput;
    taxRateBp?: number;
  },
>(input: T) {
  const totals = calculateTotals(input.items, input.discount, input.taxRateBp ?? 0);
  return {
    ...input,
    items: input.items.map((item, index) => ({ ...item, amount: totals.lineAmounts[index] })),
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    taxAmount: totals.taxAmount,
    total: totals.total,
  };
}

export async function listInvoices(query: z.infer<typeof listInvoicesSchema>) {
  const clients = query.search
    ? await Client.find(searchFilter(["name", "companyName"], query.search))
        .select("_id")
        .limit(200)
        .lean()
    : [];
  return paginate(
    Invoice,
    {
      $and: [
        { archivedAt: null },
        ...(query.search
          ? [
              {
                $or: [
                  searchFilter(["number"], query.search),
                  { client: { $in: clients.map((c) => c._id) } },
                ],
              },
            ]
          : []),
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.client ? [{ client: toObjectId(query.client) }] : []),
        ...(query.project ? [{ project: toObjectId(query.project) }] : []),
        ...(query.currency ? [{ currency: query.currency }] : []),
        ...(query.from || query.to
          ? [
              {
                issueDate: {
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
      sort: { [query.sortBy ?? "createdAt"]: query.sortOrder === "asc" ? 1 : -1 },
      populate: POPULATE,
      select: "-items",
    },
  );
}

const findInvoice = async (id: string) =>
  assertFound(await Invoice.findOne({ _id: id, archivedAt: null }), "Invoice");

export async function getInvoice(id: string) {
  const invoice = await findInvoice(id);
  await invoice.populate([
    ...POPULATE,
    populateUser("createdBy"),
    { path: "items.service", select: "name" },
  ]);
  const payments = await Payment.find({ invoice: id })
    .sort({ paymentDate: -1 })
    .populate(populateUser("recordedBy"))
    .lean();
  return { ...invoice.toObject(), payments };
}

export async function createInvoice(actor: Actor, input: z.infer<typeof createInvoiceSchema>) {
  assertFound(await Client.exists({ _id: input.client }), "Client");
  const settings = await getCompanySettings();
  const priced = withTotals(input);
  return withTransaction(async (session) => {
    const [invoice] = await Invoice.create(
      [
        {
          paymentTerms: settings.documents?.invoice?.defaultPaymentTerms ?? "",
          ...priced,
          number: await nextDocumentNumber("invoice", session),
          amountDue: priced.total,
          status: "DRAFT",
          createdBy: actor.id,
          updatedBy: actor.id,
        },
      ],
      { session },
    );
    if (!invoice) throw new Error("Invoice was not created");
    await logActivity(
      actor,
      {
        action: "invoice.created",
        description: `Invoice ${invoice.number} created`,
        entityType: "INVOICE",
        entityId: invoice._id,
        client: invoice.client,
        project: invoice.project,
      },
      session,
    );
    await audit(
      actor,
      {
        action: "invoice.create",
        entityType: "Invoice",
        entityId: invoice._id,
        summary: invoice.number,
        after: { total: invoice.total, currency: invoice.currency },
      },
      session,
    );
    return invoice;
  });
}

/** Issued invoices are immutable records; only drafts can be edited. */
export async function updateInvoice(
  actor: Actor,
  id: string,
  input: z.infer<typeof updateInvoiceSchema>,
) {
  if (input.client) assertFound(await Client.exists({ _id: input.client }), "Client");
  const invoice = await findInvoice(id);
  if (invoice.status !== "DRAFT")
    throw AppError.conflict(
      "Only draft invoices can be edited. Cancel and reissue this invoice instead.",
    );

  const merged = {
    items:
      input.items ??
      invoice.items.map((i) => ({
        service: i.service ? String(i.service) : null,
        description: i.description,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    discount: (input.discount ?? {
      type: invoice.discount?.type ?? "PERCENT",
      value: invoice.discount?.value ?? 0,
    }) as DiscountInput,
    taxRateBp: input.taxRateBp ?? invoice.taxRateBp,
  };
  const priced = withTotals(merged);
  const issueDate = input.issueDate ?? invoice.issueDate;
  const dueDate = input.dueDate ?? invoice.dueDate;
  if (dueDate < issueDate) throw AppError.badRequest("Due date cannot be before the issue date");

  invoice.set({ ...input, ...priced, amountDue: priced.total, updatedBy: actor.id });
  await invoice.save();
  await audit(actor, {
    action: "invoice.update",
    entityType: "Invoice",
    entityId: invoice._id,
    summary: invoice.number,
    after: { total: invoice.total },
  });
  return invoice;
}

/** Marks a draft as issued. Sent status records the business state, not a delivered email. */
export async function issueInvoice(
  actor: Actor,
  id: string,
  channel: "manual" | "email" = "manual",
) {
  return withTransaction(async (session) => {
    const invoice = assertFound(
      await Invoice.findOne({ _id: id, archivedAt: null }).session(session),
      "Invoice",
    );
    if (invoice.status !== "DRAFT") throw AppError.conflict("This invoice has already been issued");
    if (invoice.total <= 0)
      throw AppError.badRequest("An invoice must have a total above zero before it is issued");
    const timezone = await getCompanyTimezone();
    invoice.status = deriveInvoiceStatus({
      status: "SENT",
      total: invoice.total,
      amountPaid: invoice.amountPaid ?? 0,
      pastDue: isPastDue(invoice.dueDate, timezone),
    });
    invoice.sentAt = new Date();
    invoice.updatedBy = toObjectId(actor.id);
    await invoice.save({ session });
    await logActivity(
      actor,
      {
        action: "invoice.issued",
        description:
          channel === "email"
            ? `Invoice ${invoice.number} emailed to the client`
            : `Invoice ${invoice.number} marked as sent`,
        entityType: "INVOICE",
        entityId: invoice._id,
        client: invoice.client,
        project: invoice.project,
      },
      session,
    );
    await audit(
      actor,
      {
        action: "invoice.issue",
        entityType: "Invoice",
        entityId: invoice._id,
        summary: invoice.number,
        before: { status: "DRAFT" },
        after: { status: invoice.status, channel },
      },
      session,
    );
    return invoice;
  });
}

export async function cancelInvoice(actor: Actor, id: string, reason: string) {
  return withTransaction(async (session) => {
    const invoice = assertFound(
      await Invoice.findOne({ _id: id, archivedAt: null }).session(session),
      "Invoice",
    );
    if (invoice.status === "CANCELLED")
      throw AppError.conflict("This invoice is already cancelled");
    if ((invoice.amountPaid ?? 0) > 0)
      throw AppError.conflict("Void this invoice's payments before cancelling it");
    const before = invoice.status;
    invoice.status = "CANCELLED";
    invoice.cancelledAt = new Date();
    invoice.cancelReason = reason;
    invoice.amountDue = 0;
    invoice.updatedBy = toObjectId(actor.id);
    await invoice.save({ session });
    await logActivity(
      actor,
      {
        action: "invoice.cancelled",
        description: `Invoice ${invoice.number} cancelled: ${reason}`,
        entityType: "INVOICE",
        entityId: invoice._id,
        client: invoice.client,
        project: invoice.project,
      },
      session,
    );
    await audit(
      actor,
      {
        action: "invoice.cancel",
        entityType: "Invoice",
        entityId: invoice._id,
        summary: reason,
        before: { status: before },
        after: { status: "CANCELLED" },
      },
      session,
    );
    return invoice;
  });
}

/** Only a never-issued draft can be archived; issued invoices are retained and cancelled instead. */
export async function archiveDraft(actor: Actor, id: string) {
  const invoice = await findInvoice(id);
  if (invoice.status !== "DRAFT")
    throw AppError.conflict("Issued invoices cannot be deleted. Cancel the invoice instead.");
  invoice.archivedAt = new Date();
  await invoice.save();
  await audit(actor, {
    action: "invoice.archive",
    entityType: "Invoice",
    entityId: invoice._id,
    summary: invoice.number,
  });
}

export async function renderInvoicePdf(id: string) {
  const invoice = await findInvoice(id);
  const [client, settings] = await Promise.all([
    Client.findById(invoice.client).lean(),
    getCompanySettings(),
  ]);
  return { number: invoice.number, pdf: await invoicePdf(invoice.toObject(), client, settings) };
}

export async function emailInvoice(actor: Actor, id: string, to?: string) {
  const invoice = await findInvoice(id);
  if (invoice.status === "CANCELLED") throw AppError.conflict("A cancelled invoice cannot be sent");
  const client = await Client.findById(invoice.client).lean();
  const recipient = to || client?.email;
  if (!recipient) throw AppError.badRequest("The client has no email address. Enter a recipient.");

  const { pdf, number } = await renderInvoicePdf(id);
  const result = await sendEmail({
    to: recipient,
    subject: `Invoice ${number} from SAS3D`,
    html: `<p>Please find invoice ${number} attached.</p>`,
    attachments: [{ filename: `${number}.pdf`, content: pdf }],
  });
  // Delivery is only recorded after the provider confirms it.
  if (!result.sent) throw new AppError(502, `The invoice was not sent: ${result.reason}`);
  if (invoice.status === "DRAFT") await issueInvoice(actor, id, "email");
  else
    await logActivity(actor, {
      action: "invoice.emailed",
      description: `Invoice ${number} emailed to ${recipient}`,
      entityType: "INVOICE",
      entityId: invoice._id,
      client: invoice.client,
    });
  return { sentTo: recipient, providerId: result.providerId };
}

export const statusFor = (
  invoice: { status: string; total: number; amountPaid?: number | null; dueDate: Date },
  timezone: string,
  now = new Date(),
) =>
  deriveInvoiceStatus({
    status: invoice.status as InvoiceStatus,
    total: invoice.total,
    amountPaid: invoice.amountPaid ?? 0,
    pastDue: isPastDue(invoice.dueDate, timezone, now),
  });

export function previewTotals(input: {
  items: { quantity: number; unitPrice: number }[];
  discount?: DiscountInput;
  taxRateBp?: number;
}) {
  return calculateTotals(input.items, input.discount, input.taxRateBp ?? 0);
}
