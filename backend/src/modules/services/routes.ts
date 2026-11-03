import { Router } from "express";
import { requirePermission as can } from "../../middleware/auth.js";
import * as c from "./controller.js";

export const serviceRoutes = Router();
serviceRoutes.get("/", can("service:read"), c.list);
serviceRoutes.post("/", can("service:write"), c.create);
serviceRoutes.get("/:id", can("service:read"), c.get);
serviceRoutes.patch("/:id", can("service:write"), c.update);
serviceRoutes.delete("/:id", can("service:write"), c.deactivate);
