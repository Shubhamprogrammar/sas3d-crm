import { Schema, model } from "mongoose";
import { CURRENCIES, INVOICE_STATUSES } from "../../config/constants.js";
import { discountSchema, lineItemSchema, money, ref } from "../../database/schema-helpers.js";

const invoiceSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    client: ref("Client", { required: true }),
    project: ref("Project"),
    issueDate: { type: Date, required: true },
    dueDate: { type: Date, required: true },
    currency: { type: String, enum: CURRENCIES, required: true },
    items: { type: [lineItemSchema], default: [] },
    discount: { type: discountSchema, default: () => ({}) },
    taxRateBp: { type: Number, min: 0, max: 10000, default: 0 },
    taxLabel: { type: String, default: "Tax" },
    subtotal: money({ required: true }),
    discountAmount: money({ default: 0 }),
    taxAmount: money({ default: 0 }),
    total: money({ required: true }),
    amountPaid: money({ default: 0 }),
    // Stored alongside amountPaid so a payment can be guarded atomically against overpaying.
    amountDue: money({ required: true }),
    paymentTerms: { type: String, default: "" },
    notes: { type: String, default: "" },
    status: { type: String, enum: INVOICE_STATUSES, default: "DRAFT" },
    sentAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: "" },
    archivedAt: { type: Date, default: null },
    createdBy: ref("User"),
    updatedBy: ref("User"),
  },
  { timestamps: true },
);

invoiceSchema.index({ archivedAt: 1, status: 1, dueDate: 1 });
invoiceSchema.index({ client: 1, issueDate: -1 });
invoiceSchema.index({ project: 1 });
invoiceSchema.index({ currency: 1, issueDate: -1 });

export const Invoice = model("Invoice", invoiceSchema);
