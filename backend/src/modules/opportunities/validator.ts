import { z } from "zod";
import { PIPELINE_STAGES, PRIORITIES } from "../../config/constants.js";
import {
  currency,
  minorUnits,
  nullableDate,
  objectId,
  optionalObjectId,
  text,
} from "../../validators/common.js";
import { createProjectFields } from "../projects/validator.js";

export const boardQuerySchema = z.object({
  search: text(200).optional(),
  assignedTo: objectId.optional(),
  priority: z.enum(PRIORITIES).optional(),
  country: text(100).optional(),
  service: objectId.optional(),
});

export const moveSchema = z.object({
  to: z.enum(PIPELINE_STAGES),
  lostReason: text(1000).optional(),
});

export const createOpportunitySchema = z.object({
  title: text(200).min(1, "Title is required"),
  client: objectId,
  value: minorUnits.optional(),
  currency: currency.optional(),
  service: optionalObjectId,
  assignedTo: optionalObjectId,
  priority: z.enum(PRIORITIES).optional(),
  nextFollowUpAt: nullableDate.optional(),
});

export const updateOpportunitySchema = createOpportunitySchema.omit({ client: true }).partial();

export const convertSchema = z.object({
  project: createProjectFields.omit({ client: true }).partial().optional(),
  createProject: z.boolean().optional(),
});
