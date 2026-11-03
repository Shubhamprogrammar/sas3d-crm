import type { Request, Response } from "express";
import { actorOf } from "../../middleware/auth.js";
import { hasPermission } from "../../config/permissions.js";
import { AppError, sendOk } from "../../utils/http.js";
import { idParam } from "../../utils/query.js";
import * as service from "./service.js";
import {
  boardQuerySchema,
  convertSchema,
  createOpportunitySchema,
  moveSchema,
  updateOpportunitySchema,
} from "./validator.js";

const id = (req: Request) => idParam.parse(req.params).id;

export async function board(req: Request, res: Response) {
  sendOk(res, await service.getBoard(actorOf(req), boardQuerySchema.parse(req.query)));
}
export async function get(req: Request, res: Response) {
  sendOk(res, await service.getOpportunity(actorOf(req), id(req)));
}
export async function create(req: Request, res: Response) {
  sendOk(
    res,
    await service.createOpportunity(actorOf(req), createOpportunitySchema.parse(req.body)),
    { status: 201, message: "Opportunity created" },
  );
}
export async function update(req: Request, res: Response) {
  sendOk(
    res,
    await service.updateOpportunity(actorOf(req), id(req), updateOpportunitySchema.parse(req.body)),
    { message: "Opportunity updated" },
  );
}
export async function move(req: Request, res: Response) {
  sendOk(res, await service.moveOpportunity(actorOf(req), id(req), moveSchema.parse(req.body)), {
    message: "Stage updated",
  });
}
export async function convert(req: Request, res: Response) {
  const input = convertSchema.parse(req.body);
  const actor = actorOf(req);
  if (input.createProject !== false && !hasPermission(actor.role, "project:create"))
    throw AppError.forbidden();
  sendOk(res, await service.convertOpportunity(actor, id(req), input), {
    message: "Opportunity converted",
  });
}
