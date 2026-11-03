import { Router, type Request, type Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { CURRENCIES, LEAD_SOURCES, NOTIFICATION_TYPES, ROLES } from "../../config/constants.js";
import { env } from "../../config/env.js";
import { permissionMatrix } from "../../config/permissions.js";
import { actorOf, requirePermission as can } from "../../middleware/auth.js";
import { audit } from "../../services/audit.service.js";
import { isEmailConfigured } from "../../services/email.service.js";
import { lastJobRuns } from "../../services/jobs.service.js";
import { sendOk } from "../../utils/http.js";
import { paginate, paginationQuery, populateUser, searchFilter } from "../../utils/query.js";
import { AuditLog } from "../audit/model.js";
import { getCompanySettings, updateCompanySettings } from "./service.js";
import { updateSettingsSchema } from "./validator.js";

const EXPORTABLE = {
  leads: "Lead",
  clients: "Client",
  opportunities: "Opportunity",
  tasks: "Task",
  activities: "Activity",
  proposals: "Proposal",
  projects: "Project",
  milestones: "Milestone",
  projecttasks: "ProjectTask",
  invoices: "Invoice",
  payments: "Payment",
  services: "Service",
  auditlogs: "AuditLog",
} as const;

export const settingsRoutes = Router();

// Display preferences are needed by every signed-in user; the rest of the document is restricted.
settingsRoutes.get("/preferences", async (_req: Request, res: Response) => {
  const settings = await getCompanySettings();
  sendOk(res, { preferences: settings.preferences, companyName: settings.company?.name });
});

settingsRoutes.get("/", can("settings:read"), async (_req, res) => {
  sendOk(res, await getCompanySettings());
});

settingsRoutes.patch("/", can("settings:write"), async (req, res) => {
  const updated = await updateCompanySettings(actorOf(req), updateSettingsSchema.parse(req.body));
  sendOk(res, updated, { message: "Settings saved" });
});

settingsRoutes.get("/roles", can("settings:read"), (_req, res) => {
  sendOk(res, { roles: ROLES, matrix: permissionMatrix() });
});

settingsRoutes.get("/audit-logs", can("audit:read"), async (req, res) => {
  const query = paginationQuery
    .extend({ entityType: z.string().max(50).optional() })
    .parse(req.query);
  const { items, meta } = await paginate(
    AuditLog,
    {
      $and: [
        searchFilter(["action", "summary", "entityType"], query.search),
        ...(query.entityType ? [{ entityType: query.entityType }] : []),
      ],
    },
    {
      page: query.page,
      limit: query.limit,
      populate: [populateUser("actor")],
      select: "-before -after",
    },
  );
  sendOk(res, items, { meta });
});

settingsRoutes.get("/system", can("settings:read"), async (_req, res) => {
  const db = mongoose.connection.db;
  const counts = await Promise.all(
    Object.entries(EXPORTABLE).map(async ([key, model]) => ({
      collection: key,
      documents: await mongoose.model(model).estimatedDocumentCount(),
    })),
  );
  sendOk(res, {
    database: db?.databaseName,
    counts,
    emailConfigured: isEmailConfigured(),
    storageDriver: env.STORAGE_DRIVER,
    jobs: await lastJobRuns(),
    backupGuidance:
      "Backups are not performed by the application. Use MongoDB Atlas continuous backups or scheduled mongodump. See docs/DEPLOYMENT.md.",
    constants: {
      currencies: CURRENCIES,
      leadSources: LEAD_SOURCES,
      notificationTypes: NOTIFICATION_TYPES,
    },
  });
});

settingsRoutes.get("/export", can("data:export"), async (req, res) => {
  const { collection } = z
    .object({ collection: z.enum(Object.keys(EXPORTABLE) as [keyof typeof EXPORTABLE]) })
    .parse(req.query);
  const documents = await mongoose.model(EXPORTABLE[collection]).find().lean();
  await audit(actorOf(req), {
    action: "data.export",
    entityType: "System",
    summary: `${collection}: ${documents.length} documents`,
  });
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${collection}.json"`);
  res.send(JSON.stringify(documents));
});
