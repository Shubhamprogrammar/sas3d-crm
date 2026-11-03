import { z } from "zod";
import {
  MILESTONE_STATUSES,
  PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_UPDATE_TYPES,
  SERVICE_CATEGORIES,
  TASK_STATUSES,
} from "../../config/constants.js";
import {
  currency,
  httpUrl,
  longText,
  minorUnits,
  nullableDate,
  objectId,
  optionalObjectId,
  text,
} from "../../validators/common.js";
import { paginationQuery } from "../../utils/query.js";

export const createProjectFields = z.object({
  name: text(200).min(1, "Project name is required"),
  client: objectId,
  description: longText.optional(),
  category: z.union([z.literal(""), z.enum(SERVICE_CATEGORIES)]).optional(),
  budget: minorUnits.optional(),
  currency: currency.optional(),
  startDate: nullableDate.optional(),
  expectedDeliveryDate: nullableDate.optional(),
  actualCompletionDate: nullableDate.optional(),
  projectManager: optionalObjectId,
  team: z.array(objectId).max(100).optional(),
  priority: z.enum(PRIORITIES).optional(),
  status: z.enum(PROJECT_STATUSES).optional(),
  githubUrl: httpUrl.optional(),
  stagingUrl: httpUrl.optional(),
  productionUrl: httpUrl.optional(),
  documentationUrl: httpUrl.optional(),
  internalNotes: longText.optional(),
});
export const createProjectSchema = createProjectFields;
export const updateProjectSchema = createProjectFields.omit({ client: true }).partial();
export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export const listProjectsSchema = paginationQuery.extend({
  status: z.enum(PROJECT_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  client: objectId.optional(),
  projectManager: objectId.optional(),
  sortBy: z.enum(["createdAt", "name", "expectedDeliveryDate", "priority"]).optional(),
});

const milestoneFields = z.object({
  project: objectId,
  title: text(300).min(1, "Title is required"),
  description: longText.optional(),
  startDate: nullableDate.optional(),
  dueDate: nullableDate.optional(),
  status: z.enum(MILESTONE_STATUSES).optional(),
});
export const createMilestoneSchema = milestoneFields;
export const updateMilestoneSchema = milestoneFields.omit({ project: true }).partial();
export const listByProjectSchema = z.object({ project: objectId });

const projectTaskFields = z.object({
  project: objectId,
  milestone: optionalObjectId,
  parentTask: optionalObjectId,
  title: text(300).min(1, "Title is required"),
  description: longText.optional(),
  assignedTo: optionalObjectId,
  priority: z.enum(PRIORITIES).optional(),
  dueDate: nullableDate.optional(),
  status: z.enum(TASK_STATUSES).optional(),
});
export const createProjectTaskSchema = projectTaskFields;
export const updateProjectTaskSchema = projectTaskFields
  .omit({ project: true, parentTask: true })
  .partial();

export const createUpdateSchema = z.object({
  type: z.enum(PROJECT_UPDATE_TYPES).optional(),
  content: text(10000).min(1, "Content is required"),
});
export const pageSchema = paginationQuery;
