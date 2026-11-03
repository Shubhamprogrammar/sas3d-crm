import { z } from "zod";
import { PRIORITIES, TASK_STATUSES } from "../../config/constants.js";
import {
  longText,
  nullableDate,
  objectId,
  optionalObjectId,
  text,
} from "../../validators/common.js";
import { paginationQuery } from "../../utils/query.js";

const fields = z.object({
  title: text(300).min(1, "Title is required"),
  description: longText.optional(),
  lead: optionalObjectId,
  client: optionalObjectId,
  project: optionalObjectId,
  assignedTo: optionalObjectId,
  priority: z.enum(PRIORITIES).optional(),
  dueAt: nullableDate.optional(),
  hasDueTime: z.boolean().optional(),
  status: z.enum(TASK_STATUSES).optional(),
});
export const createTaskSchema = fields;
export const updateTaskSchema = fields.partial();
export const listTasksSchema = paginationQuery.extend({
  view: z.enum(["today", "upcoming", "overdue"]).optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assignedTo: objectId.optional(),
  lead: objectId.optional(),
  client: objectId.optional(),
  project: objectId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(20),
  sortBy: z.enum(["dueAt", "createdAt", "priority", "title"]).optional(),
});
