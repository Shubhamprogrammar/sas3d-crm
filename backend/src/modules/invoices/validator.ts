import { z } from "zod";
import { INVOICE_STATUSES } from "../../config/constants.js";
import {
  currency,
  dateRange,
  discount,
  email,
  lineItem,
  longText,
  objectId,
  optionalObjectId,
  taxRateBp,
  text,
} from "../../validators/common.js";
import { paginationQuery } from "../../utils/query.js";

const fields = z.object({
  client: objectId,
  project: optionalObjectId,
  issueDate: z.coerce.date(),
  dueDate: z.coerce.date(),
  currency,
  items: z.array(lineItem).min(1, "Add at least one line item").max(200),
  discount: discount.optional(),
  taxRateBp: taxRateBp.optional(),
  taxLabel: text(50).optional(),
  paymentTerms: longText.optional(),
  notes: longText.optional(),
});
export const createInvoiceSchema = fields.refine((i) => i.dueDate >= i.issueDate, {
  message: "Due date cannot be before the issue date",
  path: ["dueDate"],
});
export const updateInvoiceSchema = fields.partial();
export const listInvoicesSchema = paginationQuery.extend({
  status: z.enum(INVOICE_STATUSES).optional(),
  client: objectId.optional(),
  project: objectId.optional(),
  currency: currency.optional(),
  ...dateRange,
  sortBy: z.enum(["issueDate", "dueDate", "total", "number", "createdAt"]).optional(),
});
export const cancelInvoiceSchema = z.object({
  reason: text(1000).min(1, "A cancellation reason is required"),
});
export const sendInvoiceSchema = z.object({ to: email.optional() });
