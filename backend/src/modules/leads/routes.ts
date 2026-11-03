import { Router } from "express";
import multer from "multer";
import { requirePermission as can } from "../../middleware/auth.js";
import * as c from "./controller.js";

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

export const leadRoutes = Router();
leadRoutes.get("/", can("lead:read"), c.list);
leadRoutes.post("/", can("lead:write"), c.create);
leadRoutes.get("/duplicates", can("lead:read"), c.duplicates);
leadRoutes.get("/export", can("lead:export"), c.exportCsv);
leadRoutes.post("/import", can("lead:import"), csvUpload.single("file"), c.importCsv);
leadRoutes.get("/:id", can("lead:read"), c.get);
leadRoutes.patch("/:id", can("lead:write"), c.update);
leadRoutes.delete("/:id", can("lead:write"), c.archive);
leadRoutes.post("/:id/restore", can("lead:write"), c.restore);
leadRoutes.post("/:id/convert", can("lead:write", "client:write"), c.convert);
