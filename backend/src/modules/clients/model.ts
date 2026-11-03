import { Schema, model } from "mongoose";
import { CLIENT_STATUSES, CLIENT_TYPES } from "../../config/constants.js";
import { ref } from "../../database/schema-helpers.js";

const clientSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    companyName: { type: String, trim: true, default: "" },
    type: { type: String, enum: CLIENT_TYPES, default: "SMALL_BUSINESS" },
    email: { type: String, lowercase: true, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    website: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    timezone: { type: String, trim: true, default: "" },
    billingAddress: {
      line1: { type: String, default: "" },
      line2: { type: String, default: "" },
      city: { type: String, default: "" },
      state: { type: String, default: "" },
      postalCode: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    tax: {
      idType: { type: String, default: "" },
      idNumber: { type: String, default: "" },
    },
    status: { type: String, enum: CLIENT_STATUSES, default: "ACTIVE" },
    notes: { type: String, default: "" },
    relationshipManager: ref("User"),
    sourceLead: ref("Lead"),
    lastInteractionAt: { type: Date, default: null },
    createdBy: ref("User"),
    updatedBy: ref("User"),
  },
  { timestamps: true },
);

// A lead converts to at most one client, which makes conversion safe to repeat.
clientSchema.index(
  { sourceLead: 1 },
  { unique: true, partialFilterExpression: { sourceLead: { $type: "objectId" } } },
);
clientSchema.index({ status: 1, createdAt: -1 });
clientSchema.index({ relationshipManager: 1, status: 1 });
clientSchema.index({ email: 1 });
clientSchema.index({ name: 1 });

export const Client = model("Client", clientSchema);
