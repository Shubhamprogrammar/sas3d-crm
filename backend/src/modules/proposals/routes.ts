import { Router } from "express";
import { requirePermission as can } from "../../middleware/auth.js";
import * as c from "./controller.js";

export const proposalRoutes = Router();
proposalRoutes.get("/", can("proposal:read"), c.list);
proposalRoutes.post("/", can("proposal:write"), c.create);
proposalRoutes.get("/:id", can("proposal:read"), c.get);
proposalRoutes.patch("/:id", can("proposal:write"), c.update);
proposalRoutes.delete("/:id", can("proposal:write"), c.remove);
proposalRoutes.get("/:id/pdf", can("proposal:read"), c.pdf);
proposalRoutes.get("/:id/revisions", can("proposal:read"), c.revisions);
proposalRoutes.post("/:id/duplicate", can("proposal:write"), c.duplicate);
proposalRoutes.post("/:id/status", can("proposal:write"), c.setStatus);
proposalRoutes.post("/:id/send", can("proposal:write"), c.send);
