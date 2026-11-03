import { Router } from "express";
import { requirePermission as can } from "../../middleware/auth.js";
import * as c from "./controller.js";

export const activityRoutes = Router();
activityRoutes.get("/", can("activity:read"), c.list);
activityRoutes.post("/", can("activity:write"), c.create);
