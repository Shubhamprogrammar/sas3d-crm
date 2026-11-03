import { Router } from "express";
import { actorOf, requirePermission as can } from "../../middleware/auth.js";
import { sendOk } from "../../utils/http.js";
import { dashboardQuerySchema, getDashboard } from "./service.js";

export const dashboardRoutes = Router();

dashboardRoutes.get("/", can("dashboard:read"), async (req, res) => {
  sendOk(res, await getDashboard(actorOf(req), dashboardQuerySchema.parse(req.query)));
});
