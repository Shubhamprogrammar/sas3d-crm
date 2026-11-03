import type { Request, Response } from "express";
import { actorOf } from "../../middleware/auth.js";
import { sendOk } from "../../utils/http.js";
import { idParam } from "../../utils/query.js";
import * as service from "./service.js";
import {
  createProposalSchema,
  listProposalsSchema,
  sendProposalSchema,
  statusSchema,
  updateProposalSchema,
} from "./validator.js";

const id = (req: Request) => idParam.parse(req.params).id;

export async function list(req: Request, res: Response) {
  const { items, meta } = await service.listProposals(
    actorOf(req),
    listProposalsSchema.parse(req.query),
  );
  sendOk(res, items, { meta });
}
export async function get(req: Request, res: Response) {
  sendOk(res, await service.getProposal(actorOf(req), id(req)));
}
export async function create(req: Request, res: Response) {
  sendOk(res, await service.createProposal(actorOf(req), createProposalSchema.parse(req.body)), {
    status: 201,
    message: "Proposal created",
  });
}
export async function update(req: Request, res: Response) {
  sendOk(
    res,
    await service.updateProposal(actorOf(req), id(req), updateProposalSchema.parse(req.body)),
    { message: "Proposal updated" },
  );
}
export async function duplicate(req: Request, res: Response) {
  sendOk(res, await service.duplicateProposal(actorOf(req), id(req)), {
    status: 201,
    message: "Proposal duplicated",
  });
}
export async function revisions(req: Request, res: Response) {
  sendOk(res, await service.listRevisions(actorOf(req), id(req)));
}
export async function setStatus(req: Request, res: Response) {
  sendOk(
    res,
    await service.setProposalStatus(actorOf(req), id(req), statusSchema.parse(req.body).status),
    { message: "Proposal status updated" },
  );
}
export async function send(req: Request, res: Response) {
  const result = await service.emailProposal(
    actorOf(req),
    id(req),
    sendProposalSchema.parse(req.body).to,
  );
  sendOk(res, result, { message: `Proposal emailed to ${result.sentTo}` });
}
export async function remove(req: Request, res: Response) {
  await service.archiveProposal(actorOf(req), id(req));
  sendOk(res, null, { message: "Proposal deleted" });
}
export async function pdf(req: Request, res: Response) {
  const { pdf: file, number } = await service.renderProposalPdf(actorOf(req), id(req));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${number}.pdf"`);
  res.send(file);
}
