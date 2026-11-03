import { Schema, model } from "mongoose";
import { CURRENCIES } from "../../config/constants.js";
import { ref } from "../../database/schema-helpers.js";

const numberingSchema = {
  prefix: { type: String, default: "" },
  padding: { type: Number, min: 3, max: 8, default: 4 },
  includeYear: { type: Boolean, default: true },
};

const companySettingsSchema = new Schema(
  {
    key: { type: String, default: "default", unique: true },
    company: {
      name: { type: String, default: "SAS3D" },
      logoUrl: { type: String, default: "" },
      website: { type: String, default: "https://sas3d.in" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      address: { type: String, default: "" },
      taxInfo: { type: String, default: "" },
    },
    preferences: {
      defaultCurrency: { type: String, enum: CURRENCIES, default: "INR" },
      timezone: { type: String, default: "Asia/Kolkata" },
      dateFormat: {
        type: String,
        enum: ["DD MMM YYYY", "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"],
        default: "DD MMM YYYY",
      },
      timeFormat: { type: String, enum: ["12h", "24h"], default: "12h" },
      theme: { type: String, enum: ["light", "dark", "system"], default: "light" },
    },
    documents: {
      proposal: {
        ...numberingSchema,
        prefix: { type: String, default: "PROP" },
        introduction: { type: String, default: "" },
        defaultTerms: { type: String, default: "" },
        footer: { type: String, default: "" },
      },
      invoice: {
        ...numberingSchema,
        prefix: { type: String, default: "INV" },
        defaultPaymentTerms: { type: String, default: "" },
        bankDetails: { type: String, default: "" },
        footer: { type: String, default: "" },
      },
    },
    updatedBy: ref("User"),
  },
  { timestamps: true },
);

/** Atomic sequence source for document numbers. */
const counterSchema = new Schema({ _id: String, value: { type: Number, default: 0 } });
/** Prevents two API instances from running the same scheduled job at once. */
const jobLockSchema = new Schema({ _id: String, lockedUntil: Date });

export const CompanySettings = model("CompanySettings", companySettingsSchema);
export const Counter = model("Counter", counterSchema);
export const JobLock = model("JobLock", jobLockSchema);
