import { Schema, model } from "mongoose";
import { ref } from "../../database/schema-helpers.js";

const attachmentSchema = new Schema(
  {
    entityType: { type: String, enum: ["LEAD", "CLIENT", "PROJECT"], required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    driver: { type: String, enum: ["local", "cloudinary"], required: true },
    storageKey: { type: String, required: true },
    url: { type: String, default: "" },
    uploadedBy: ref("User"),
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
attachmentSchema.index({ entityType: 1, entityId: 1, deletedAt: 1, createdAt: -1 });

export const Attachment = model("Attachment", attachmentSchema);
