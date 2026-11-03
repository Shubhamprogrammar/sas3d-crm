import { z } from "zod";
import { CLIENT_STATUSES, CLIENT_TYPES } from "../../config/constants.js";
import {
  email,
  httpUrl,
  longText,
  optionalObjectId,
  phone,
  text,
  timezone,
} from "../../validators/common.js";
import { paginationQuery } from "../../utils/query.js";

const address = z
  .object({
    line1: text(200),
    line2: text(200),
    city: text(100),
    state: text(100),
    postalCode: text(30),
    country: text(100),
  })
  .partial();

const fields = {
  name: text(200).min(1, "Client name is required"),
  companyName: text(200),
  type: z.enum(CLIENT_TYPES),
  email,
  phone,
  website: httpUrl,
  country: text(100),
  city: text(100),
  timezone,
  billingAddress: address,
  tax: z.object({ idType: text(50), idNumber: text(100) }).partial(),
  status: z.enum(CLIENT_STATUSES),
  notes: longText,
  relationshipManager: optionalObjectId,
};

export const createClientSchema = z.object(fields).partial().required({ name: true });
export const updateClientSchema = z.object(fields).partial();
export const listClientsSchema = paginationQuery.extend({
  status: z.enum(CLIENT_STATUSES).optional(),
  type: z.enum(CLIENT_TYPES).optional(),
  country: text(100).optional(),
  sortBy: z.enum(["createdAt", "name", "companyName", "lastInteractionAt"]).optional(),
});
