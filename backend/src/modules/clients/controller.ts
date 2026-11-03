import type { Request, Response } from "express";
import { actorOf } from "../../middleware/auth.js";
import { sendOk } from "../../utils/http.js";
import { idParam } from "../../utils/query.js";
import * as service from "./service.js";
import { createClientSchema, listClientsSchema, updateClientSchema } from "./validator.js";

const id = (req: Request) => idParam.parse(req.params).id;

export async function list(req: Request, res: Response) {
  const { items, meta } = await service.listClients(
    actorOf(req),
    listClientsSchema.parse(req.query),
  );
  sendOk(res, items, { meta });
}
export async function get(req: Request, res: Response) {
  sendOk(res, await service.getClient(actorOf(req), id(req)));
}
export async function create(req: Request, res: Response) {
  sendOk(res, await service.createClient(actorOf(req), createClientSchema.parse(req.body)), {
    status: 201,
    message: "Client created",
  });
}
export async function update(req: Request, res: Response) {
  sendOk(
    res,
    await service.updateClient(actorOf(req), id(req), updateClientSchema.parse(req.body)),
    { message: "Client updated" },
  );
}
export async function archive(req: Request, res: Response) {
  sendOk(res, await service.archiveClient(actorOf(req), id(req)), { message: "Client archived" });
}
