import { z } from "zod";
import { COMMUNICATION_TYPES } from "../../config/constants.js";
import {
  longText,
  nullableDate,
  objectId,
  optionalObjectId,
  text,
} from "../../validators/common.js";
import { paginationQuery } from "../../utils/query.js";

export const logCommunicationSchema = z
  .object({
    lead: optionalObjectId,
    client: optionalObjectId,
    commType: z.enum(COMMUNICATION_TYPES),
    subject: text(300).min(1, "Subject is required"),
    description: longText.optional(),
    occurredAt: z.coerce.date().optional(),
    nextFollowUpAt: nullableDate.optional(),
  })
  .refine((a) => a.lead || a.client, { message: "Choose a lead or a client", path: ["lead"] });

export const listActivitiesSchema = paginationQuery.extend({
  kind: z.enum(["SYSTEM", "COMMUNICATION"]).optional(),
  commType: z.enum(COMMUNICATION_TYPES).optional(),
  lead: objectId.optional(),
  client: objectId.optional(),
  project: objectId.optional(),
});
