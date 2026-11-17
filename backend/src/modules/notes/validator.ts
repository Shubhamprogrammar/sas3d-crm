import { z } from "zod";
import { objectId, text } from "../../validators/common.js";
import { paginationQuery } from "../../utils/query.js";
import { NOTE_VISIBILITIES } from "./model.js";

/** Large enough for long meeting notes; images are uploaded separately, never inlined. */
const MAX_CONTENT = 300_000;

const tags = z
  .array(text(40).toLowerCase().min(1))
  .max(20)
  .transform((list) => [...new Set(list)]);

const fields = z.object({
  title: text(200).min(1, "Title is required"),
  content: z.string().max(MAX_CONTENT, "This note is too long").optional(),
  tags: tags.optional(),
  visibility: z.enum(NOTE_VISIBILITIES).optional(),
  pinned: z.boolean().optional(),
});

export const createNoteSchema = fields;
export const updateNoteSchema = fields.partial().extend({
  /** The `updatedAt` the editor started from; a mismatch means someone else saved first. */
  baseUpdatedAt: z.coerce.date().optional(),
});
export const pinNoteSchema = z.object({ pinned: z.boolean() });

export const listNotesSchema = paginationQuery.extend({
  scope: z.enum(["all", "mine", "team"]).default("all"),
  tag: text(40).toLowerCase().optional(),
  pinned: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});

export const mentionQuery = z.object({ q: z.string().trim().max(100).default("") });
export const versionParams = z.object({ id: objectId, versionId: objectId });
