import { Schema, model } from "mongoose";
import { CURRENCIES, PIPELINE_STAGES, PRIORITIES } from "../../config/constants.js";
import { money, ref } from "../../database/schema-helpers.js";

const opportunitySchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    lead: ref("Lead"),
    client: ref("Client"),
    project: ref("Project"),
    // Denormalised from the lead so that loading the board needs no joins.
    contactName: { type: String, default: "" },
    companyName: { type: String, default: "" },
    country: { type: String, default: "" },
    stage: { type: String, enum: PIPELINE_STAGES, default: "NEW" },
    value: money({ default: 0 }),
    currency: { type: String, enum: CURRENCIES, default: "USD" },
    service: ref("Service"),
    assignedTo: ref("User"),
    priority: { type: String, enum: PRIORITIES, default: "MEDIUM" },
    nextFollowUpAt: { type: Date, default: null },
    lostReason: { type: String, default: "" },
    wonAt: { type: Date, default: null },
    lostAt: { type: Date, default: null },
    stageChangedAt: { type: Date, default: Date.now },
    archivedAt: { type: Date, default: null },
    createdBy: ref("User"),
    updatedBy: ref("User"),
  },
  { timestamps: true },
);

// One pipeline card per lead; opportunities for existing clients have no lead.
opportunitySchema.index(
  { lead: 1 },
  { unique: true, partialFilterExpression: { lead: { $type: "objectId" } } },
);
opportunitySchema.index({ archivedAt: 1, stage: 1, stageChangedAt: -1 });
opportunitySchema.index({ assignedTo: 1, stage: 1 });
opportunitySchema.index({ client: 1 });

const stageHistorySchema = new Schema(
  {
    opportunity: ref("Opportunity", { required: true }),
    from: { type: String, enum: [...PIPELINE_STAGES, null], default: null },
    to: { type: String, enum: PIPELINE_STAGES, required: true },
    reason: { type: String, default: "" },
    changedBy: ref("User"),
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
stageHistorySchema.index({ opportunity: 1, createdAt: -1 });

export const Opportunity = model("Opportunity", opportunitySchema);
export const StageHistory = model("StageHistory", stageHistorySchema);
