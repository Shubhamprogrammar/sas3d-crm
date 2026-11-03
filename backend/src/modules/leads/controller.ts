import type { Request, Response } from "express";
import { actorOf } from "../../middleware/auth.js";
import { AppError, sendCsv, sendOk } from "../../utils/http.js";
import { idParam } from "../../utils/query.js";
import * as service from "./service.js";
import {
  createLeadSchema,
  duplicateCheckSchema,
  listLeadsSchema,
  updateLeadSchema,
} from "./validator.js";

const id = (req: Request) => idParam.parse(req.params).id;

export async function list(req: Request, res: Response) {
  const { items, meta } = await service.listLeads(actorOf(req), listLeadsSchema.parse(req.query));
  sendOk(res, items, { meta });
}
export async function get(req: Request, res: Response) {
  sendOk(res, await service.getLead(actorOf(req), id(req)));
}
export async function create(req: Request, res: Response) {
  const lead = await service.createLead(actorOf(req), createLeadSchema.parse(req.body));
  sendOk(res, lead, { status: 201, message: "Lead created" });
}
export async function update(req: Request, res: Response) {
  sendOk(res, await service.updateLead(actorOf(req), id(req), updateLeadSchema.parse(req.body)), {
    message: "Lead updated",
  });
}
export async function archive(req: Request, res: Response) {
  sendOk(res, await service.archiveLead(actorOf(req), id(req)), { message: "Lead archived" });
}
export async function restore(req: Request, res: Response) {
  sendOk(res, await service.restoreLead(actorOf(req), id(req)), { message: "Lead restored" });
}
export async function duplicates(req: Request, res: Response) {
  sendOk(res, await service.findDuplicates(duplicateCheckSchema.parse(req.query)));
}
export async function convert(req: Request, res: Response) {
  const result = await service.convertLead(actorOf(req), id(req));
  sendOk(res, result, {
    message: result.alreadyConverted ? "Lead was already converted" : "Lead converted to client",
  });
}
export async function importCsv(req: Request, res: Response) {
  if (!req.file) throw AppError.badRequest("A CSV file is required");
  sendOk(res, await service.importLeads(actorOf(req), req.file.buffer), {
    message: "Import finished",
  });
}
export async function exportCsv(req: Request, res: Response) {
  const csv = await service.exportLeads(actorOf(req), listLeadsSchema.parse(req.query));
  sendCsv(res, "leads.csv", csv);
}
