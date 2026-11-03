import { Router } from "express";
import { requirePermission as can } from "../../middleware/auth.js";
import * as c from "./controller.js";

export const opportunityRoutes = Router();
opportunityRoutes.get("/board", can("opportunity:read"), c.board);
opportunityRoutes.post("/", can("opportunity:write"), c.create);
opportunityRoutes.get("/:id", can("opportunity:read"), c.get);
opportunityRoutes.patch("/:id", can("opportunity:write"), c.update);
opportunityRoutes.post("/:id/move", can("opportunity:write"), c.move);
opportunityRoutes.post("/:id/convert", can("opportunity:convert"), c.convert);
