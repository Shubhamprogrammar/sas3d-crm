import { Schema, model } from "mongoose";
import { CURRENCIES, PRICING_MODELS, SERVICE_CATEGORIES } from "../../config/constants.js";
import { money, ref } from "../../database/schema-helpers.js";

const serviceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, unique: true, maxlength: 200 },
    description: { type: String, default: "" },
    category: { type: String, enum: SERVICE_CATEGORIES, required: true },
    startingPrice: money({ default: 0 }),
    currency: { type: String, enum: CURRENCIES, default: "USD" },
    pricingModel: { type: String, enum: PRICING_MODELS, default: "FIXED" },
    estimatedDelivery: { type: String, default: "" },
    technologies: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    createdBy: ref("User"),
    updatedBy: ref("User"),
  },
  { timestamps: true },
);
serviceSchema.index({ isActive: 1, category: 1 });

export const Service = model("Service", serviceSchema);
