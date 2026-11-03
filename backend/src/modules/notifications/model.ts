import { Schema, model } from "mongoose";
import { NOTIFICATION_TYPES, RELATED_TYPES } from "../../config/constants.js";
import { ref } from "../../database/schema-helpers.js";

const notificationSchema = new Schema(
  {
    recipient: ref("User", { required: true }),
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, default: "" },
    link: { type: String, default: "" },
    entityType: { type: String, enum: [...RELATED_TYPES, null], default: null },
    entityId: { type: Schema.Types.ObjectId, default: null },
    readAt: { type: Date, default: null },
    // Jobs run repeatedly; this makes each reminder at most once per recipient.
    dedupeKey: { type: String },
  },
  { timestamps: true },
);

notificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true });

export const Notification = model("Notification", notificationSchema);
