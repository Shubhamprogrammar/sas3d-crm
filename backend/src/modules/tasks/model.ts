import { Schema, model } from "mongoose";
import { PRIORITIES, TASK_STATUSES } from "../../config/constants.js";
import { ref } from "../../database/schema-helpers.js";

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    description: { type: String, default: "" },
    lead: ref("Lead"),
    client: ref("Client"),
    project: ref("Project"),
    assignedTo: ref("User"),
    priority: { type: String, enum: PRIORITIES, default: "MEDIUM" },
    // A UTC instant combining the due date and time. Date-only tasks are due at the end of that day.
    dueAt: { type: Date, default: null },
    hasDueTime: { type: Boolean, default: false },
    status: { type: String, enum: TASK_STATUSES, default: "TODO" },
    completedAt: { type: Date, default: null },
    completedBy: ref("User"),
    deletedAt: { type: Date, default: null },
    createdBy: ref("User"),
    updatedBy: ref("User"),
  },
  { timestamps: true },
);

taskSchema.index({ deletedAt: 1, assignedTo: 1, status: 1, dueAt: 1 });
taskSchema.index({ status: 1, dueAt: 1 });
taskSchema.index({ lead: 1 });
taskSchema.index({ client: 1 });
taskSchema.index({ project: 1 });

export const Task = model("Task", taskSchema);
