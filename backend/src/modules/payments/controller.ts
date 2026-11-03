import type { Request, Response } from "express";
import { actorOf } from "../../middleware/auth.js";
import { sendOk } from "../../utils/http.js";
import { idParam } from "../../utils/query.js";
import * as service from "./service.js";
import { listPaymentsSchema, recordPaymentSchema, voidPaymentSchema } from "./validator.js";

export async function list(req: Request, res: Response) {
  const { items, meta } = await service.listPayments(listPaymentsSchema.parse(req.query));
  sendOk(res, items, { meta });
}
export async function record(req: Request, res: Response) {
  sendOk(res, await service.recordPayment(actorOf(req), recordPaymentSchema.parse(req.body)), {
    status: 201,
    message: "Payment recorded",
  });
}
export async function voidOne(req: Request, res: Response) {
  const { id } = idParam.parse(req.params);
  sendOk(
    res,
    await service.voidPayment(actorOf(req), id, voidPaymentSchema.parse(req.body).reason),
    { message: "Payment voided" },
  );
}
