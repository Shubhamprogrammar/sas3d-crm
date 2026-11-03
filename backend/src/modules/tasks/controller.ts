import type { Request, Response } from "express";
import { actorOf } from "../../middleware/auth.js";
import { sendOk } from "../../utils/http.js";
import { idParam } from "../../utils/query.js";
import * as service from "./service.js";
import { createTaskSchema, listTasksSchema, updateTaskSchema } from "./validator.js";

const id = (req: Request) => idParam.parse(req.params).id;

export async function list(req: Request, res: Response) {
  const { items, meta } = await service.listTasks(actorOf(req), listTasksSchema.parse(req.query));
  sendOk(res, items, { meta });
}
export async function get(req: Request, res: Response) {
  sendOk(res, await service.getTask(actorOf(req), id(req)));
}
export async function create(req: Request, res: Response) {
  sendOk(res, await service.createTask(actorOf(req), createTaskSchema.parse(req.body)), {
    status: 201,
    message: "Task created",
  });
}
export async function update(req: Request, res: Response) {
  sendOk(res, await service.updateTask(actorOf(req), id(req), updateTaskSchema.parse(req.body)), {
    message: "Task updated",
  });
}
export async function remove(req: Request, res: Response) {
  await service.deleteTask(actorOf(req), id(req));
  sendOk(res, null, { message: "Task deleted" });
}
