import { Schema, model } from "mongoose";
import { CURRENCIES, PROPOSAL_STATUSES } from "../../config/constants.js";
import { discountSchema, lineItemSchema, money, ref } from "../../database/schema-helpers.js";

const proposalSchema = new Schema(
  {
    number: { type: String, required: true, unique: true },
    client: ref("Client"),
    lead: ref("Lead"),
    opportunity: ref("Opportunity"),
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: "" },
    scope: { type: String, default: "" },
    deliverables: { type: [String], default: [] },
    technologies: { type: [String], default: [] },
    timeline: { type: String, default: "" },
    items: { type: [lineItemSchema], default: [] },
    currency: { type: String, enum: CURRENCIES, required: true },
    discount: { type: discountSchema, default: () => ({}) },
    taxRateBp: { type: Number, min: 0, max: 10000, default: 0 },
    taxLabel: { type: String, default: "Tax" },
    subtotal: money({ default: 0 }),
    discountAmount: money({ default: 0 }),
    taxAmount: money({ default: 0 }),
    total: money({ default: 0 }),
    paymentTerms: { type: String, default: "" },
    validUntil: { type: Date, default: null },
    terms: { type: String, default: "" },
    notes: { type: String, default: "" },
    status: { type: String, enum: PROPOSAL_STATUSES, default: "DRAFT" },
    revision: { type: Number, default: 1 },
    sentAt: { type: Date, default: null },
    viewedAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    rejectedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    createdBy: ref("User"),
    updatedBy: ref("User"),
  },
  { timestamps: true },
);

proposalSchema.index({ archivedAt: 1, status: 1, createdAt: -1 });
proposalSchema.index({ client: 1, createdAt: -1 });
proposalSchema.index({ lead: 1 });
proposalSchema.index({ opportunity: 1 });
proposalSchema.index({ createdBy: 1 });
proposalSchema.index({ status: 1, validUntil: 1 });

const proposalRevisionSchema = new Schema(
  {
    proposal: ref("Proposal", { required: true }),
    revision: { type: Number, required: true },
    snapshot: { type: Schema.Types.Mixed, required: true },
    changedBy: ref("User"),
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
proposalRevisionSchema.index({ proposal: 1, revision: -1 }, { unique: true });

export const Proposal = model("Proposal", proposalSchema);
export const ProposalRevision = model("ProposalRevision", proposalRevisionSchema);
