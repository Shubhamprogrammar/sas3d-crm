import { Activity } from "../modules/activities/model.js";
import { Attachment } from "../modules/attachments/model.js";
import { AuditLog } from "../modules/audit/model.js";
import { Client } from "../modules/clients/model.js";
import { Invoice } from "../modules/invoices/model.js";
import { Lead } from "../modules/leads/model.js";
import { Notification } from "../modules/notifications/model.js";
import { Opportunity, StageHistory } from "../modules/opportunities/model.js";
import { Payment } from "../modules/payments/model.js";
import { Milestone, Project, ProjectTask, ProjectUpdate } from "../modules/projects/model.js";
import { Proposal, ProposalRevision } from "../modules/proposals/model.js";
import { Service } from "../modules/services/model.js";
import { CompanySettings, Counter, JobLock } from "../modules/settings/model.js";
import { Task } from "../modules/tasks/model.js";
import { User } from "../modules/users/model.js";
import mongoose from "mongoose";

const ALL_MODELS = [
  Activity,
  Attachment,
  AuditLog,
  Client,
  Invoice,
  Lead,
  Notification,
  Opportunity,
  StageHistory,
  Payment,
  Milestone,
  Project,
  ProjectTask,
  ProjectUpdate,
  Proposal,
  ProposalRevision,
  Service,
  CompanySettings,
  Counter,
  JobLock,
  Task,
  User,
];

/**
 * Creates collections and indexes up front, because a unique index must exist before concurrent
 * writes rely on it and transactions run more reliably on collections that already exist.
 */
export async function initDatabase() {
  await Promise.all(ALL_MODELS.map((model) => model.init()));
  await Promise.all(ALL_MODELS.map((model) => model.createCollection().catch(() => undefined)));

  const db = mongoose.connection.db;
  if (!db) throw new Error("Database is not connected");
  // Better Auth does not create indexes for its own collections on MongoDB.
  await Promise.all([
    db.collection("session").createIndex({ token: 1 }, { unique: true }),
    db.collection("session").createIndex({ userId: 1 }),
    db.collection("session").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    db.collection("account").createIndex({ userId: 1 }),
    db.collection("verification").createIndex({ identifier: 1 }),
    db.collection("verification").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
  ]);
}
