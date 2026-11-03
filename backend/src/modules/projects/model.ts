import { Schema, model } from "mongoose";
import {
  CURRENCIES,
  MILESTONE_STATUSES,
  PRIORITIES,
  PROJECT_STATUSES,
  PROJECT_UPDATE_TYPES,
  TASK_STATUSES,
} from "../../config/constants.js";
import { money, ref } from "../../database/schema-helpers.js";

const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 200 },
    code: { type: String, required: true, unique: true },
    client: ref("Client", { required: true }),
    opportunity: ref("Opportunity"),
    description: { type: String, default: "" },
    category: { type: String, default: "" },
    budget: money({ default: 0 }),
    currency: { type: String, enum: CURRENCIES, default: "USD" },
    startDate: { type: Date, default: null },
    expectedDeliveryDate: { type: Date, default: null },
    actualCompletionDate: { type: Date, default: null },
    projectManager: ref("User"),
    team: [{ type: Schema.Types.ObjectId, ref: "User" }],
    priority: { type: String, enum: PRIORITIES, default: "MEDIUM" },
    status: { type: String, enum: PROJECT_STATUSES, default: "NOT_STARTED" },
    githubUrl: { type: String, default: "" },
    stagingUrl: { type: String, default: "" },
    productionUrl: { type: String, default: "" },
    documentationUrl: { type: String, default: "" },
    internalNotes: { type: String, default: "" },
    archivedAt: { type: Date, default: null },
    createdBy: ref("User"),
    updatedBy: ref("User"),
  },
  { timestamps: true },
);

projectSchema.index({ archivedAt: 1, status: 1, createdAt: -1 });
projectSchema.index({ client: 1 });
projectSchema.index({ projectManager: 1, status: 1 });
projectSchema.index({ team: 1, status: 1 });
// A won opportunity converts to at most one project.
projectSchema.index(
  { opportunity: 1 },
  { unique: true, partialFilterExpression: { opportunity: { $type: "objectId" } } },
);

const milestoneSchema = new Schema(
  {
    project: ref("Project", { required: true }),
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: "" },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: MILESTONE_STATUSES, default: "PENDING" },
    completedAt: { type: Date, default: null },
    createdBy: ref("User"),
    updatedBy: ref("User"),
  },
  { timestamps: true },
);
milestoneSchema.index({ project: 1, dueDate: 1 });
milestoneSchema.index({ status: 1, dueDate: 1 });

const projectTaskSchema = new Schema(
  {
    project: ref("Project", { required: true }),
    milestone: ref("Milestone"),
    parentTask: ref("ProjectTask"),
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: "" },
    assignedTo: ref("User"),
    priority: { type: String, enum: PRIORITIES, default: "MEDIUM" },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: TASK_STATUSES, default: "TODO" },
    completedAt: { type: Date, default: null },
    createdBy: ref("User"),
    updatedBy: ref("User"),
  },
  { timestamps: true },
);
projectTaskSchema.index({ project: 1, parentTask: 1, createdAt: 1 });
projectTaskSchema.index({ assignedTo: 1, status: 1 });
projectTaskSchema.index({ milestone: 1 });

const projectUpdateSchema = new Schema(
  {
    project: ref("Project", { required: true }),
    type: { type: String, enum: PROJECT_UPDATE_TYPES, default: "UPDATE" },
    content: { type: String, required: true, maxlength: 10000 },
    author: ref("User"),
  },
  { timestamps: true },
);
projectUpdateSchema.index({ project: 1, createdAt: -1 });

export const Project = model("Project", projectSchema);
export const Milestone = model("Milestone", milestoneSchema);
export const ProjectTask = model("ProjectTask", projectTaskSchema);
export const ProjectUpdate = model("ProjectUpdate", projectUpdateSchema);
