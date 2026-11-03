import { z } from "zod";
import { LEAD_SOURCES, PIPELINE_STAGES, PRIORITIES } from "../../config/constants.js";
import {
  currency,
  email,
  httpUrl,
  longText,
  minorUnits,
  nullableDate,
  objectId,
  optionalObjectId,
  phone,
  text,
  timezone,
} from "../../validators/common.js";
import { paginationQuery } from "../../utils/query.js";

const fields = {
  fullName: text(200).min(1, "Full name is required"),
  companyName: text(200),
  email,
  phone,
  whatsapp: phone,
  country: text(100),
  state: text(100),
  city: text(100),
  timezone,
  website: httpUrl,
  linkedinUrl: httpUrl,
  source: z.enum(LEAD_SOURCES),
  interestedServices: z.array(objectId).max(30),
  estimatedBudget: minorUnits,
  budgetCurrency: currency,
  priority: z.enum(PRIORITIES),
  assignedTo: optionalObjectId,
  description: longText,
  requirements: longText,
  internalNotes: longText,
  lastContactedAt: nullableDate,
  nextFollowUpAt: nullableDate,
};

export const createLeadSchema = z
  .object(fields)
  .partial()
  .required({ fullName: true })
  .extend({ allowDuplicate: z.boolean().optional() });

// Status is deliberately absent: it changes only through the pipeline, which records history.
export const updateLeadSchema = z.object(fields).partial();

export const listLeadsSchema = paginationQuery.extend({
  status: z.enum(PIPELINE_STAGES).optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  country: text(100).optional(),
  service: objectId.optional(),
  assignedTo: objectId.optional(),
  archived: z.enum(["true", "false"]).optional(),
  sortBy: z
    .enum(["createdAt", "fullName", "companyName", "estimatedBudget", "nextFollowUpAt", "priority"])
    .optional(),
});

export const duplicateCheckSchema = z.object({
  email: email.optional(),
  phone: phone.optional(),
  excludeId: objectId.optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsSchema>;
