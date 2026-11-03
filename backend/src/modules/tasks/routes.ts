import { Router } from "express";
import { requirePermission as can } from "../../middleware/auth.js";
import * as c from "./controller.js";

export const taskRoutes = Router();
taskRoutes.get("/", can("task:read"), c.list);
taskRoutes.post("/", can("task:write"), c.create);
taskRoutes.get("/:id", can("task:read"), c.get);
taskRoutes.patch("/:id", can("task:write"), c.update);
taskRoutes.delete("/:id", can("task:delete"), c.remove);
