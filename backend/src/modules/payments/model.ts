import { Schema, model } from "mongoose";
import { CURRENCIES, PAYMENT_METHODS } from "../../config/constants.js";
import { money, ref } from "../../database/schema-helpers.js";

const paymentSchema = new Schema(
  {
    invoice: ref("Invoice", { required: true }),
    client: ref("Client", { required: true }),
    amount: money({ required: true, min: 1 }),
    currency: { type: String, enum: CURRENCIES, required: true },
    paymentDate: { type: Date, required: true },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    transactionReference: { type: String, trim: true, default: "" },
    notes: { type: String, default: "" },
    recordedBy: ref("User"),
    // Payments are never deleted; a mistaken entry is voided, which restores the invoice balance.
    voidedAt: { type: Date, default: null },
    voidedBy: ref("User"),
    voidReason: { type: String, default: "" },
  },
  { timestamps: true },
);

paymentSchema.index({ invoice: 1, paymentDate: -1 });
paymentSchema.index({ client: 1, paymentDate: -1 });
paymentSchema.index({ currency: 1, paymentDate: -1 });
// Stops the same bank or gateway reference from being recorded twice against one invoice.
paymentSchema.index(
  { invoice: 1, transactionReference: 1 },
  {
    unique: true,
    partialFilterExpression: { transactionReference: { $gt: "" }, voidedAt: null },
  },
);

export const Payment = model("Payment", paymentSchema);
