import { Router } from "express";
import { requirePermission as can } from "../../middleware/auth.js";
import * as c from "./controller.js";

export const paymentRoutes = Router();
paymentRoutes.get("/", can("payment:read"), c.list);
paymentRoutes.post("/", can("payment:write"), c.record);
paymentRoutes.post("/:id/void", can("payment:write"), c.voidOne);
