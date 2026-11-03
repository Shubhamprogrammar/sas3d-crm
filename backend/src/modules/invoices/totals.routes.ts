import { Router } from "express";
import { hasPermission } from "../../config/permissions.js";
import { actorOf } from "../../middleware/auth.js";
import { AppError } from "../../utils/http.js";
import * as c from "./controller.js";

// Shared by the invoice and proposal editors, so totals are only ever computed by one code path.
export const invoiceTotalsRoutes = Router();
invoiceTotalsRoutes.post(
  "/",
  (req, _res, next) => {
    const { role } = actorOf(req);
    if (!hasPermission(role, "invoice:write") && !hasPermission(role, "proposal:write"))
      throw AppError.forbidden();
    next();
  },
  c.preview,
);
