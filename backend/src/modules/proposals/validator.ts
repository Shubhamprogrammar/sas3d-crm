import { z } from "zod";
import { PROPOSAL_STATUSES } from "../../config/constants.js";
import {
  currency,
  discount,
  email,
  lineItem,
  longText,
  nullableDate,
  objectId,
  optionalObjectId,
  stringList,
  taxRateBp,
  text,
} from "../../validators/common.js";
import { paginationQuery } from "../../utils/query.js";

const fields = z.object({
  client: optionalObjectId,
  lead: optionalObjectId,
  opportunity: optionalObjectId,
  title: text(300).min(1, "Project title is required"),
  description: longText.optional(),
  scope: longText.optional(),
  deliverables: stringList.optional(),
  technologies: stringList.optional(),
  timeline: text(2000).optional(),
  items: z.array(lineItem).max(200),
  currency,
  discount: discount.optional(),
  taxRateBp: taxRateBp.optional(),
  taxLabel: text(50).optional(),
  paymentTerms: longText.optional(),
  validUntil: nullableDate.optional(),
  terms: longText.optional(),
  notes: longText.optional(),
});
export const createProposalSchema = fields.refine((p) => p.client || p.lead, {
  message: "Choose a client or a lead",
  path: ["client"],
});
export const updateProposalSchema = fields.partial();
export const listProposalsSchema = paginationQuery.extend({
  status: z.enum(PROPOSAL_STATUSES).optional(),
  client: objectId.optional(),
  lead: objectId.optional(),
  sortBy: z.enum(["createdAt", "number", "total", "validUntil"]).optional(),
});
export const statusSchema = z.object({
  status: z.enum(["SENT", "VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"]),
});
export const sendProposalSchema = z.object({ to: email.optional() });
