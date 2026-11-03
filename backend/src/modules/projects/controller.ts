import type { Request, Response } from "express";
import { actorOf } from "../../middleware/auth.js";
import { sendOk } from "../../utils/http.js";
import { idParam } from "../../utils/query.js";
import * as service from "./service.js";
import * as v from "./validator.js";

const id = (req: Request) => idParam.parse(req.params).id;
const projectQuery = (req: Request) => v.listByProjectSchema.parse(req.query).project;

export const projects = {
  async list(req: Request, res: Response) {
    const { items, meta } = await service.listProjects(
      actorOf(req),
      v.listProjectsSchema.parse(req.query),
    );
    sendOk(res, items, { meta });
  },
  async get(req: Request, res: Response) {
    sendOk(res, await service.getProject(actorOf(req), id(req)));
  },
  async create(req: Request, res: Response) {
    sendOk(res, await service.createProject(actorOf(req), v.createProjectSchema.parse(req.body)), {
      status: 201,
      message: "Project created",
    });
  },
  async update(req: Request, res: Response) {
    sendOk(
      res,
      await service.updateProject(actorOf(req), id(req), v.updateProjectSchema.parse(req.body)),
      { message: "Project updated" },
    );
  },
  async archive(req: Request, res: Response) {
    sendOk(res, await service.archiveProject(actorOf(req), id(req)), {
      message: "Project archived",
    });
  },
  async listUpdates(req: Request, res: Response) {
    const { page, limit } = v.pageSchema.parse(req.query);
    const { items, meta } = await service.listUpdates(actorOf(req), id(req), page, limit);
    sendOk(res, items, { meta });
  },
  async addUpdate(req: Request, res: Response) {
    sendOk(
      res,
      await service.addUpdate(actorOf(req), id(req), v.createUpdateSchema.parse(req.body)),
      { status: 201, message: "Update added" },
    );
  },
};

export const milestones = {
  async list(req: Request, res: Response) {
    sendOk(res, await service.listMilestones(actorOf(req), projectQuery(req)));
  },
  async create(req: Request, res: Response) {
    sendOk(
      res,
      await service.createMilestone(actorOf(req), v.createMilestoneSchema.parse(req.body)),
      { status: 201, message: "Milestone created" },
    );
  },
  async update(req: Request, res: Response) {
    sendOk(
      res,
      await service.updateMilestone(actorOf(req), id(req), v.updateMilestoneSchema.parse(req.body)),
      { message: "Milestone updated" },
    );
  },
  async remove(req: Request, res: Response) {
    await service.deleteMilestone(actorOf(req), id(req));
    sendOk(res, null, { message: "Milestone deleted" });
  },
};

export const projectTasks = {
  async list(req: Request, res: Response) {
    sendOk(res, await service.listProjectTasks(actorOf(req), projectQuery(req)));
  },
  async create(req: Request, res: Response) {
    sendOk(
      res,
      await service.createProjectTask(actorOf(req), v.createProjectTaskSchema.parse(req.body)),
      { status: 201, message: "Task created" },
    );
  },
  async update(req: Request, res: Response) {
    sendOk(
      res,
      await service.updateProjectTask(
        actorOf(req),
        id(req),
        v.updateProjectTaskSchema.parse(req.body),
      ),
      { message: "Task updated" },
    );
  },
  async remove(req: Request, res: Response) {
    await service.deleteProjectTask(actorOf(req), id(req));
    sendOk(res, null, { message: "Task deleted" });
  },
};
