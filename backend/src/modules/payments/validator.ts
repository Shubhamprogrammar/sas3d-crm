import { z } from "zod";
import { PAYMENT_METHODS } from "../../config/constants.js";
import { currency, dateRange, longText, objectId, text } from "../../validators/common.js";
import { paginationQuery } from "../../utils/query.js";

export const recordPaymentSchema = z.object({
  invoice: objectId,
  amount: z.number().int().positive("Amount must be above zero").max(Number.MAX_SAFE_INTEGER),
  currency,
  paymentDate: z.coerce.date(),
  method: z.enum(PAYMENT_METHODS),
  transactionReference: text(200).optional(),
  notes: longText.optional(),
});
export const voidPaymentSchema = z.object({ reason: text(1000).min(1, "A reason is required") });
export const listPaymentsSchema = paginationQuery.extend({
  invoice: objectId.optional(),
  client: objectId.optional(),
  currency: currency.optional(),
  method: z.enum(PAYMENT_METHODS).optional(),
  ...dateRange,
});
