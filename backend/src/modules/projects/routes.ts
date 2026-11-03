import { Router } from "express";
import { requirePermission as can } from "../../middleware/auth.js";
import { milestones, projects, projectTasks } from "./controller.js";

export const projectRoutes = Router();
projectRoutes.get("/", can("project:read"), projects.list);
projectRoutes.post("/", can("project:create"), projects.create);
projectRoutes.get("/:id", can("project:read"), projects.get);
projectRoutes.patch("/:id", can("project:write"), projects.update);
projectRoutes.delete("/:id", can("project:delete"), projects.archive);
projectRoutes.get("/:id/updates", can("project:read"), projects.listUpdates);
projectRoutes.post("/:id/updates", can("project:read", "activity:write"), projects.addUpdate);

export const milestoneRoutes = Router();
milestoneRoutes.get("/", can("project:read"), milestones.list);
milestoneRoutes.post("/", can("project:write"), milestones.create);
milestoneRoutes.patch("/:id", can("project:write"), milestones.update);
milestoneRoutes.delete("/:id", can("project:write"), milestones.remove);

export const projectTaskRoutes = Router();
projectTaskRoutes.get("/", can("project:read"), projectTasks.list);
projectTaskRoutes.post("/", can("project:write"), projectTasks.create);
projectTaskRoutes.patch("/:id", can("projecttask:write"), projectTasks.update);
projectTaskRoutes.delete("/:id", can("project:write"), projectTasks.remove);
