import cors from "cors";
import express, { Router } from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import mongoose from "mongoose";
import { toNodeHandler } from "better-auth/node";
import { getAuth } from "./config/auth.js";
import { allowedOrigins, env, isTest } from "./config/env.js";
import { logger } from "./config/logger.js";
import { requireAuth } from "./middleware/auth.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { rejectCrossOriginWrites, rejectMongoOperators } from "./middleware/security.js";
import { activityRoutes } from "./modules/activities/routes.js";
import { attachmentRoutes } from "./modules/attachments/routes.js";
import { clientRoutes } from "./modules/clients/routes.js";
import { dashboardRoutes } from "./modules/dashboard/routes.js";
import { invoiceRoutes } from "./modules/invoices/routes.js";
import { leadRoutes } from "./modules/leads/routes.js";
import { meRoutes } from "./modules/me/routes.js";
import { notificationRoutes } from "./modules/notifications/routes.js";
import { opportunityRoutes } from "./modules/opportunities/routes.js";
import { paymentRoutes } from "./modules/payments/routes.js";
import { milestoneRoutes, projectRoutes, projectTaskRoutes } from "./modules/projects/routes.js";
import { proposalRoutes } from "./modules/proposals/routes.js";
import { reportRoutes } from "./modules/reports/routes.js";
import { searchRoutes } from "./modules/search/routes.js";
import { serviceRoutes } from "./modules/services/routes.js";
import { settingsRoutes } from "./modules/settings/routes.js";
import { taskRoutes } from "./modules/tasks/routes.js";
import { teamRoutes } from "./modules/team/routes.js";
import { invoiceTotalsRoutes } from "./modules/invoices/totals.routes.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY);

  app.use(helmet());
  app.use(cors({ origin: allowedOrigins, credentials: true }));
  app.use((req, res, next) => {
    const started = Date.now();
    res.on("finish", () => {
      logger.info(
        { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - started },
        "request",
      );
    });
    next();
  });

  app.get("/api/v1/health", async (_req, res) => {
    const connected = mongoose.connection.readyState === 1;
    res.status(connected ? 200 : 503).json({
      success: connected,
      message: connected ? "OK" : "Database unavailable",
      data: { database: connected ? "connected" : "disconnected" },
      meta: {},
    });
  });

  if (!isTest) {
    app.use(
      "/api/v1",
      rateLimit({
        windowMs: 60_000,
        limit: 600,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        message: { success: false, message: "Too many requests. Please slow down.", errors: [] },
      }),
    );
  }

  // Better Auth reads the raw request body, so it must be mounted before the JSON parser.
  app.all("/api/v1/auth/*splat", toNodeHandler(getAuth()));

  app.use(express.json({ limit: "1mb" }));
  app.use(rejectCrossOriginWrites);
  app.use(rejectMongoOperators);

  const api = Router();
  api.use(requireAuth);
  api.use("/me", meRoutes);
  api.use("/dashboard", dashboardRoutes);
  api.use("/leads", leadRoutes);
  api.use("/opportunities", opportunityRoutes);
  api.use("/clients", clientRoutes);
  api.use("/tasks", taskRoutes);
  api.use("/activities", activityRoutes);
  api.use("/proposals", proposalRoutes);
  api.use("/projects", projectRoutes);
  api.use("/milestones", milestoneRoutes);
  api.use("/project-tasks", projectTaskRoutes);
  api.use("/invoices/preview-totals", invoiceTotalsRoutes);
  api.use("/invoices", invoiceRoutes);
  api.use("/payments", paymentRoutes);
  api.use("/services", serviceRoutes);
  api.use("/team", teamRoutes);
  api.use("/reports", reportRoutes);
  api.use("/notifications", notificationRoutes);
  api.use("/settings", settingsRoutes);
  api.use("/attachments", attachmentRoutes);
  api.use("/search", searchRoutes);
  app.use("/api/v1", api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
