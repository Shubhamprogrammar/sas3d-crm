import { Router } from "express";
import { requirePermission as can } from "../../middleware/auth.js";
import * as c from "./controller.js";

export const invoiceRoutes = Router();
invoiceRoutes.get("/", can("invoice:read"), c.list);
invoiceRoutes.post("/", can("invoice:write"), c.create);
invoiceRoutes.get("/:id", can("invoice:read"), c.get);
invoiceRoutes.patch("/:id", can("invoice:write"), c.update);
invoiceRoutes.delete("/:id", can("invoice:write"), c.remove);
invoiceRoutes.get("/:id/pdf", can("invoice:read"), c.pdf);
invoiceRoutes.post("/:id/issue", can("invoice:write"), c.issue);
invoiceRoutes.post("/:id/send", can("invoice:write"), c.send);
invoiceRoutes.post("/:id/cancel", can("invoice:write"), c.cancel);
