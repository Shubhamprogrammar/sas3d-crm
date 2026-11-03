import type { Request, Response } from "express";
import { actorOf } from "../../middleware/auth.js";
import { sendOk } from "../../utils/http.js";
import * as service from "./service.js";
import { listActivitiesSchema, logCommunicationSchema } from "./validator.js";

export async function list(req: Request, res: Response) {
  const { items, meta } = await service.listActivities(
    actorOf(req),
    listActivitiesSchema.parse(req.query),
  );
  sendOk(res, items, { meta });
}
export async function create(req: Request, res: Response) {
  sendOk(
    res,
    await service.logCommunication(actorOf(req), logCommunicationSchema.parse(req.body)),
    { status: 201, message: "Communication logged" },
  );
}
