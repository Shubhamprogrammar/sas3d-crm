import { Router } from "express";
import { requirePermission as can } from "../../middleware/auth.js";
import * as c from "./controller.js";

export const clientRoutes = Router();
clientRoutes.get("/", can("client:read"), c.list);
clientRoutes.post("/", can("client:write"), c.create);
clientRoutes.get("/:id", can("client:read"), c.get);
clientRoutes.patch("/:id", can("client:write"), c.update);
clientRoutes.delete("/:id", can("client:delete"), c.archive);
