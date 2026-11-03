import { Schema, model } from "mongoose";
import { COMMUNICATION_TYPES, RELATED_TYPES } from "../../config/constants.js";
import { ref } from "../../database/schema-helpers.js";

/** Holds both system events (kind SYSTEM) and logged communication (kind COMMUNICATION). */
const activitySchema = new Schema(
  {
    kind: { type: String, enum: ["SYSTEM", "COMMUNICATION"], default: "SYSTEM" },
    action: { type: String, default: "" },
    commType: { type: String, enum: [...COMMUNICATION_TYPES, null], default: null },
    subject: { type: String, trim: true, default: "" },
    description: { type: String, default: "" },
    occurredAt: { type: Date, default: Date.now },
    nextFollowUpAt: { type: Date, default: null },
    entityType: { type: String, enum: [...RELATED_TYPES, null], default: null },
    entityId: { type: Schema.Types.ObjectId, default: null },
    lead: ref("Lead"),
    client: ref("Client"),
    project: ref("Project"),
    actor: ref("User"),
    // Where integrations will record the provider and message id; "manual" for logged entries.
    channel: { type: String, default: "manual" },
    externalId: { type: String, default: "" },
  },
  { timestamps: true },
);

activitySchema.index({ occurredAt: -1 });
activitySchema.index({ lead: 1, occurredAt: -1 });
activitySchema.index({ client: 1, occurredAt: -1 });
activitySchema.index({ project: 1, occurredAt: -1 });
activitySchema.index({ actor: 1, occurredAt: -1 });

export const Activity = model("Activity", activitySchema);
