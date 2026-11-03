import { z } from "zod";
import { ROLES, USER_STATUSES } from "../../config/constants.js";
import { httpUrl, nullableDate, phone, stringList, text } from "../../validators/common.js";
import { paginationQuery } from "../../utils/query.js";

const fields = {
  name: text(200).min(1, "Name is required"),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  phone: phone.optional(),
  image: httpUrl.optional(),
  role: z.enum(ROLES),
  designation: text(200).optional(),
  joiningDate: nullableDate.optional(),
  skills: stringList.optional(),
};
export const createMemberSchema = z.object({
  ...fields,
  password: z.string().min(10, "Use at least 10 characters").max(128),
});
export const updateMemberSchema = z.object(fields).partial();
export const setStatusSchema = z.object({ status: z.enum(USER_STATUSES) });
export const listTeamSchema = paginationQuery.extend({
  role: z.enum(ROLES).optional(),
  status: z.enum(USER_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});
