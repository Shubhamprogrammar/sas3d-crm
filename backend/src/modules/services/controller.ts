import type { Request, Response } from "express";
import { actorOf } from "../../middleware/auth.js";
import { sendOk } from "../../utils/http.js";
import { idParam } from "../../utils/query.js";
import * as service from "./service.js";
import { createServiceSchema, listServicesSchema, updateServiceSchema } from "./validator.js";

const id = (req: Request) => idParam.parse(req.params).id;

export async function list(req: Request, res: Response) {
  const { items, meta } = await service.listServices(listServicesSchema.parse(req.query));
  sendOk(res, items, { meta });
}
export async function get(req: Request, res: Response) {
  sendOk(res, await service.getService(id(req)));
}
export async function create(req: Request, res: Response) {
  sendOk(res, await service.createService(actorOf(req), createServiceSchema.parse(req.body)), {
    status: 201,
    message: "Service created",
  });
}
export async function update(req: Request, res: Response) {
  sendOk(
    res,
    await service.updateService(actorOf(req), id(req), updateServiceSchema.parse(req.body)),
    { message: "Service updated" },
  );
}
export async function deactivate(req: Request, res: Response) {
  sendOk(res, await service.deactivateService(actorOf(req), id(req)), {
    message: "Service deactivated",
  });
}
