import type { Request, Response } from "express";
import { actorOf } from "../../middleware/auth.js";
import { sendOk } from "../../utils/http.js";
import { idParam } from "../../utils/query.js";
import { totalsPreview } from "../../validators/common.js";
import * as service from "./service.js";
import {
  cancelInvoiceSchema,
  createInvoiceSchema,
  listInvoicesSchema,
  sendInvoiceSchema,
  updateInvoiceSchema,
} from "./validator.js";

const id = (req: Request) => idParam.parse(req.params).id;

export async function list(req: Request, res: Response) {
  const { items, meta } = await service.listInvoices(listInvoicesSchema.parse(req.query));
  sendOk(res, items, { meta });
}
export async function get(req: Request, res: Response) {
  sendOk(res, await service.getInvoice(id(req)));
}
export async function create(req: Request, res: Response) {
  sendOk(res, await service.createInvoice(actorOf(req), createInvoiceSchema.parse(req.body)), {
    status: 201,
    message: "Invoice created",
  });
}
export async function update(req: Request, res: Response) {
  sendOk(
    res,
    await service.updateInvoice(actorOf(req), id(req), updateInvoiceSchema.parse(req.body)),
    { message: "Invoice updated" },
  );
}
export async function issue(req: Request, res: Response) {
  sendOk(res, await service.issueInvoice(actorOf(req), id(req)), {
    message: "Invoice marked as sent",
  });
}
export async function send(req: Request, res: Response) {
  const result = await service.emailInvoice(
    actorOf(req),
    id(req),
    sendInvoiceSchema.parse(req.body).to,
  );
  sendOk(res, result, { message: `Invoice emailed to ${result.sentTo}` });
}
export async function cancel(req: Request, res: Response) {
  sendOk(
    res,
    await service.cancelInvoice(actorOf(req), id(req), cancelInvoiceSchema.parse(req.body).reason),
    { message: "Invoice cancelled" },
  );
}
export async function remove(req: Request, res: Response) {
  await service.archiveDraft(actorOf(req), id(req));
  sendOk(res, null, { message: "Draft invoice deleted" });
}
export async function pdf(req: Request, res: Response) {
  const { pdf: file, number } = await service.renderInvoicePdf(id(req));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${number}.pdf"`);
  res.send(file);
}
export function preview(req: Request, res: Response) {
  sendOk(res, service.previewTotals(totalsPreview.parse(req.body)));
}
