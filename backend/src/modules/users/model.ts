import { Schema, model, type InferSchemaType } from "mongoose";
import { NOTIFICATION_TYPES, ROLES, USER_STATUSES } from "../../config/constants.js";

/**
 * Better Auth owns the `user` collection's identity fields and stores credentials separately in
 * `account`, so password hashes can never be read through this model.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, unique: true },
    emailVerified: { type: Boolean, default: false },
    image: { type: String, default: null },
    role: { type: String, enum: ROLES, default: "DEVELOPER", index: true },
    status: { type: String, enum: USER_STATUSES, default: "ACTIVE", index: true },
    phone: { type: String, default: "" },
    designation: { type: String, default: "" },
    joiningDate: { type: Date, default: null },
    skills: { type: [String], default: [] },
    mutedNotifications: { type: [String], enum: NOTIFICATION_TYPES, default: [] },
  },
  { timestamps: true, collection: "user" },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
