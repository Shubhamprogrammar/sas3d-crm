import type { Model, PopulateOptions, QueryFilter, ClientSession } from "mongoose";
import { z } from "zod";

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier");
export const optionalObjectId = z.preprocess(
  (value) => (value === "" ? null : value),
  objectId.nullable().optional(),
);
export const idParam = z.object({ id: objectId });

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Case-insensitive contains-match across fields, with user input always escaped. */
export function searchFilter(fields: string[], term?: string) {
  if (!term) return {};
  const regex = new RegExp(escapeRegex(term), "i");
  return { $or: fields.map((field) => ({ [field]: regex })) };
}

export interface PageOptions {
  page: number;
  limit: number;
  sort?: Record<string, 1 | -1>;
  populate?: PopulateOptions[];
  select?: string;
}

export async function paginate<T>(
  model: Model<T>,
  filter: QueryFilter<T>,
  { page, limit, sort = { createdAt: -1 }, populate = [], select }: PageOptions,
) {
  const [items, total] = await Promise.all([
    model
      .find(filter)
      .select(select ?? "")
      .sort({ ...sort, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate(populate)
      .lean(),
    model.countDocuments(filter),
  ]);
  return { items, meta: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) } };
}

export const USER_SUMMARY = { path: "", select: "name email image role designation" };
export const populateUser = (path: string): PopulateOptions => ({ ...USER_SUMMARY, path });
export const populateNamed = (path: string, select: string): PopulateOptions => ({ path, select });

export type Session = ClientSession | undefined;
