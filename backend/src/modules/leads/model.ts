import { Schema, model } from "mongoose";
import { CURRENCIES, LEAD_SOURCES, PIPELINE_STAGES, PRIORITIES } from "../../config/constants.js";
import { money, ref } from "../../database/schema-helpers.js";

const leadSchema = new Schema(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 200 },
    companyName: { type: String, trim: true, default: "" },
    email: { type: String, lowercase: true, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    // Digits only, so "+1 (415) 555-0100" and "14155550100" are detected as duplicates.
    phoneDigits: { type: String, default: "" },
    whatsapp: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    timezone: { type: String, trim: true, default: "" },
    website: { type: String, trim: true, default: "" },
    linkedinUrl: { type: String, trim: true, default: "" },
    source: { type: String, enum: LEAD_SOURCES, default: "OTHER" },
    interestedServices: [{ type: Schema.Types.ObjectId, ref: "Service" }],
    estimatedBudget: money({ default: 0 }),
    budgetCurrency: { type: String, enum: CURRENCIES, default: "USD" },
    priority: { type: String, enum: PRIORITIES, default: "MEDIUM" },
    status: { type: String, enum: PIPELINE_STAGES, default: "NEW" },
    assignedTo: ref("User"),
    description: { type: String, default: "" },
    requirements: { type: String, default: "" },
    internalNotes: { type: String, default: "" },
    lastContactedAt: { type: Date, default: null },
    nextFollowUpAt: { type: Date, default: null },
    opportunity: ref("Opportunity"),
    convertedClient: ref("Client"),
    convertedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    createdBy: ref("User"),
    updatedBy: ref("User"),
  },
  { timestamps: true },
);

leadSchema.index({ archivedAt: 1, createdAt: -1 });
leadSchema.index({ assignedTo: 1, status: 1, createdAt: -1 });
leadSchema.index({ source: 1, createdAt: -1 });
leadSchema.index({ country: 1, createdAt: -1 });
leadSchema.index({ status: 1, createdAt: -1 });
leadSchema.index({ interestedServices: 1 });
leadSchema.index({ email: 1 });
leadSchema.index({ phoneDigits: 1 });
leadSchema.index({ nextFollowUpAt: 1 });

export const Lead = model("Lead", leadSchema);
