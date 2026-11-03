import type { z } from "zod";
import { toObjectId, withTransaction } from "../../database/connection.js";
import { logActivity } from "../../services/activity.service.js";
import { audit } from "../../services/audit.service.js";
import { notifyMany } from "../../services/notification.service.js";
import { assertFound } from "../../services/scope.service.js";
import type { Actor } from "../../types/express.js";
import { AppError } from "../../utils/http.js";
import { formatMinor } from "../../utils/money.js";
import { paginate, populateNamed, populateUser, searchFilter } from "../../utils/query.js";
import { Invoice } from "../invoices/model.js";
import { statusFor } from "../invoices/service.js";
import { getCompanyTimezone } from "../settings/service.js";
import { User } from "../users/model.js";
import { Payment } from "./model.js";
import type { listPaymentsSchema, recordPaymentSchema } from "./validator.js";

export function listPayments(query: z.infer<typeof listPaymentsSchema>) {
  return paginate(
    Payment,
    {
      $and: [
        searchFilter(["transactionReference"], query.search),
        ...(query.invoice ? [{ invoice: toObjectId(query.invoice) }] : []),
        ...(query.client ? [{ client: toObjectId(query.client) }] : []),
        ...(query.currency ? [{ currency: query.currency }] : []),
        ...(query.method ? [{ method: query.method }] : []),
        ...(query.from || query.to
          ? [
              {
                paymentDate: {
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
      sort: { paymentDate: query.sortOrder === "asc" ? 1 : -1 },
      populate: [
        populateNamed("invoice", "number"),
        populateNamed("client", "name companyName"),
        populateUser("recordedBy"),
      ],
    },
  );
}

/**
 * Records a payment and its balance change atomically. The `amountDue: { $gte: amount }` guard in
 * the update means concurrent payments can never push an invoice past its total.
 */
export async function recordPayment(actor: Actor, input: z.infer<typeof recordPaymentSchema>) {
  const timezone = await getCompanyTimezone();
  return withTransaction(async (session) => {
    const current = assertFound(
      await Invoice.findOne({ _id: input.invoice, archivedAt: null }).session(session),
      "Invoice",
    );
    if (current.status === "DRAFT")
      throw AppError.conflict("Issue this invoice before recording a payment");
    if (current.status === "CANCELLED")
      throw AppError.conflict("Payments cannot be recorded on a cancelled invoice");
    if (current.currency !== input.currency) {
      throw AppError.badRequest(
        `This invoice is in ${current.currency}. Record the payment in the same currency.`,
      );
    }

    const invoice = await Invoice.findOneAndUpdate(
      {
        _id: current._id,
        status: { $nin: ["DRAFT", "CANCELLED"] },
        amountDue: { $gte: input.amount },
      },
      {
        $inc: { amountPaid: input.amount, amountDue: -input.amount },
        $set: { updatedBy: actor.id },
      },
      { returnDocument: "after", session },
    );
    if (!invoice) {
      throw AppError.conflict(
        `Payment exceeds the outstanding balance of ${formatMinor(current.amountDue ?? 0, current.currency)}`,
      );
    }

    const before = current.status;
    invoice.status = statusFor(invoice, timezone) as typeof invoice.status;
    invoice.paidAt = invoice.status === "PAID" ? new Date() : null;
    await invoice.save({ session });

    const [payment] = await Payment.create(
      [{ ...input, client: invoice.client, recordedBy: actor.id }],
      { session },
    );
    if (!payment) throw new Error("Payment was not created");

    const description = `Payment of ${formatMinor(payment.amount, payment.currency)} recorded on ${invoice.number}`;
    await logActivity(
      actor,
      {
        action: "payment.recorded",
        description,
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
        action: "payment.record",
        entityType: "Payment",
        entityId: payment._id,
        summary: description,
        before: { invoiceStatus: before, amountDue: current.amountDue },
        after: { invoiceStatus: invoice.status, amountDue: invoice.amountDue },
      },
      session,
    );

    const financeTeam = await User.find({
      role: { $in: ["FINANCE", "SUPER_ADMIN"] },
      status: "ACTIVE",
    })
      .select("_id")
      .session(session)
      .lean();
    await notifyMany(
      [invoice.createdBy, ...financeTeam.map((u) => u._id)].filter(
        (u) => u && String(u) !== actor.id,
      ),
      {
        type: "PAYMENT_RECORDED",
        title: "Payment recorded",
        message: description,
        link: `/invoices/${invoice._id}`,
        entityType: "INVOICE",
        entityId: invoice._id,
      },
      session,
    );
    return { payment, invoice };
  });
}

/** Reverses a mistaken entry while keeping it on record, and restores the invoice balance. */
export async function voidPayment(actor: Actor, id: string, reason: string) {
  const timezone = await getCompanyTimezone();
  return withTransaction(async (session) => {
    const payment = assertFound(
      await Payment.findOneAndUpdate(
        { _id: id, voidedAt: null },
        { $set: { voidedAt: new Date(), voidedBy: actor.id, voidReason: reason } },
        { returnDocument: "after", session },
      ),
      "Active payment",
    );

    const invoice = assertFound(
      await Invoice.findOneAndUpdate(
        { _id: payment.invoice, amountPaid: { $gte: payment.amount } },
        {
          $inc: { amountPaid: -payment.amount, amountDue: payment.amount },
          $set: { paidAt: null, updatedBy: actor.id },
        },
        { returnDocument: "after", session },
      ),
      "Invoice",
    );
    invoice.status = statusFor(invoice, timezone) as typeof invoice.status;
    await invoice.save({ session });

    const description = `Payment of ${formatMinor(payment.amount, payment.currency)} voided on ${invoice.number}: ${reason}`;
    await logActivity(
      actor,
      {
        action: "payment.voided",
        description,
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
        action: "payment.void",
        entityType: "Payment",
        entityId: payment._id,
        summary: description,
        after: { invoiceStatus: invoice.status, amountDue: invoice.amountDue },
      },
      session,
    );
    return { payment, invoice };
  });
}
