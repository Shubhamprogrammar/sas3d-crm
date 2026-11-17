import { readFile } from "node:fs/promises";
import path from "node:path";
import type { z } from "zod";
import { env } from "../../config/env.js";
import { hasGlobalScope } from "../../config/permissions.js";
import { toObjectId } from "../../database/connection.js";
import { audit } from "../../services/audit.service.js";
import { notify } from "../../services/notification.service.js";
import { assertFound } from "../../services/scope.service.js";
import { assertAllowedFile, readLocalFile, storeFile } from "../../services/storage.service.js";
import type { Actor } from "../../types/express.js";
import { AppError } from "../../utils/http.js";
import { escapeRegex, paginate, populateUser, searchFilter } from "../../utils/query.js";
import { User } from "../users/model.js";
import { processNoteContent } from "./content.js";
import { Note, NoteImage, NoteVersion } from "./model.js";
import type { createNoteSchema, listNotesSchema, updateNoteSchema } from "./validator.js";

const MAX_VERSIONS = 50;
const PREVIEW_LENGTH = 280;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/gif", "image/webp"];
const MAX_IMAGE_BYTES = Math.min(env.MAX_UPLOAD_MB, 5) * 1024 * 1024;
const POPULATE = [populateUser("createdBy"), populateUser("updatedBy")];

const me = (actor: Actor) => toObjectId(actor.id);

/** A note is visible to its author, and to everyone once it is shared with the team. */
export const visibleNotes = (actor: Actor) => ({
  deletedAt: null,
  $or: [{ createdBy: me(actor) }, { visibility: "TEAM" as const }],
});

type NoteLike = { createdBy?: unknown; visibility?: string | null };
const authorId = (note: NoteLike) => {
  const author = note.createdBy as { _id?: unknown } | null | undefined;
  return String(author?._id ?? author ?? "");
};
const isAuthor = (actor: Actor, note: NoteLike) => authorId(note) === actor.id;

/** The author edits their notes; administrators may also moderate notes shared with the team. */
const canEdit = (actor: Actor, note: NoteLike) =>
  isAuthor(actor, note) || (note.visibility === "TEAM" && hasGlobalScope(actor.role));

function assertCanEdit(actor: Actor, note: NoteLike) {
  if (!canEdit(actor, note))
    throw AppError.forbidden("Only the author or an administrator can change this note");
}

const findVisible = async (actor: Actor, id: string) =>
  assertFound(await Note.findOne({ $and: [{ _id: id }, visibleNotes(actor)] }), "Note");

export async function listNotes(actor: Actor, query: z.infer<typeof listNotesSchema>) {
  const { items, meta } = await paginate(
    Note,
    {
      $and: [
        visibleNotes(actor),
        searchFilter(["title", "contentText", "tags"], query.search),
        ...(query.scope === "mine" ? [{ createdBy: me(actor) }] : []),
        ...(query.scope === "team" ? [{ visibility: "TEAM" as const }] : []),
        ...(query.tag ? [{ tags: query.tag }] : []),
        ...(query.pinned ? [{ pinned: query.pinned === "true" }] : []),
      ],
    },
    {
      page: query.page,
      limit: query.limit,
      sort: { pinned: -1, updatedAt: -1 },
      populate: POPULATE,
      select: "-content -mentions -notifiedMentions -images",
    },
  );
  return {
    items: items.map((note) => ({
      ...note,
      contentText: note.contentText.slice(0, PREVIEW_LENGTH),
      canEdit: canEdit(actor, note),
    })),
    meta,
  };
}

export async function listTags(actor: Actor) {
  const tags = (await Note.distinct("tags", visibleNotes(actor))) as string[];
  return tags.sort();
}

export async function getNote(actor: Actor, id: string) {
  const note = assertFound(
    await Note.findOne({ $and: [{ _id: id }, visibleNotes(actor)] })
      .select("-notifiedMentions")
      .populate(POPULATE)
      .lean(),
    "Note",
  );
  return { ...note, canEdit: canEdit(actor, note) };
}

/** Rejects images the actor could not already open, so embedding cannot leak someone's upload. */
async function assertImagesUsable(actor: Actor, ids: string[], alreadyInNote: string[] = []) {
  const fresh = ids.filter((id) => !alreadyInNote.includes(id));
  for (const id of fresh) {
    if (!(await canViewImage(actor, id)))
      throw AppError.badRequest("The note contains an image you cannot use");
  }
}

/** Keeps only mentions of real, active users. */
async function activeUsers(ids: string[]) {
  if (!ids.length) return [];
  const users = await User.find({ _id: { $in: ids }, status: "ACTIVE" })
    .select("_id")
    .lean();
  return users.map((user) => String(user._id));
}

async function notifyMentions(actor: Actor, note: InstanceType<typeof Note>) {
  if (note.visibility !== "TEAM") return;
  const notified = new Set(note.notifiedMentions.map(String));
  const pending = note.mentions.map(String).filter((id) => id !== actor.id && !notified.has(id));
  if (!pending.length) return;
  for (const recipient of pending) {
    await notify({
      recipient,
      type: "NOTE_MENTION",
      title: `${actor.name} mentioned you in a note`,
      message: note.title,
      link: `/notes?note=${note._id}`,
      entityType: "NOTE",
      entityId: note._id,
    });
  }
  await Note.updateOne(
    { _id: note._id },
    { $addToSet: { notifiedMentions: { $each: pending.map(toObjectId) } } },
    { timestamps: false },
  );
}

export async function createNote(actor: Actor, input: z.infer<typeof createNoteSchema>) {
  const processed = processNoteContent(input.content ?? "");
  await assertImagesUsable(actor, processed.images);
  const note = await Note.create({
    title: input.title,
    tags: input.tags ?? [],
    visibility: input.visibility ?? "PRIVATE",
    pinned: input.pinned ?? false,
    ...processed,
    mentions: await activeUsers(processed.mentions),
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  await notifyMentions(actor, note);
  await audit(actor, {
    action: "note.create",
    entityType: "Note",
    entityId: note._id,
    summary: note.title,
  });
  return getNote(actor, String(note._id));
}

export async function updateNote(
  actor: Actor,
  id: string,
  input: z.infer<typeof updateNoteSchema>,
) {
  const note = await findVisible(actor, id);
  assertCanEdit(actor, note);
  if (input.baseUpdatedAt && note.updatedAt.getTime() !== input.baseUpdatedAt.getTime()) {
    throw AppError.conflict(
      "This note was changed by someone else after you opened it. Copy your changes, then reload the note.",
    );
  }
  if (input.visibility && input.visibility !== note.visibility && !isAuthor(actor, note)) {
    throw AppError.forbidden("Only the author can change who sees this note");
  }

  const processed = input.content === undefined ? null : processNoteContent(input.content);
  if (processed) await assertImagesUsable(actor, processed.images, note.images.map(String));

  const titleChanged = input.title !== undefined && input.title !== note.title;
  const contentChanged = processed !== null && processed.content !== note.content;
  if (titleChanged || contentChanged) {
    await NoteVersion.create({
      note: note._id,
      title: note.title,
      content: note.content,
      contentText: note.contentText,
      images: note.images,
      editedBy: note.updatedBy,
      editedAt: note.updatedAt,
    });
    const stale = await NoteVersion.find({ note: note._id })
      .sort({ createdAt: -1 })
      .skip(MAX_VERSIONS)
      .select("_id")
      .lean();
    if (stale.length) await NoteVersion.deleteMany({ _id: { $in: stale.map((v) => v._id) } });
  }

  note.set({
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
    ...(input.pinned !== undefined ? { pinned: input.pinned } : {}),
    ...(processed ? { ...processed, mentions: await activeUsers(processed.mentions) } : {}),
    updatedBy: actor.id,
  });
  await note.save();
  await notifyMentions(actor, note);
  await audit(actor, {
    action: "note.update",
    entityType: "Note",
    entityId: note._id,
    summary: note.title,
  });
  return getNote(actor, id);
}

/** Pinning only reorders the list, so it does not count as an edit or bump "edited by". */
export async function pinNote(actor: Actor, id: string, pinned: boolean) {
  const note = await findVisible(actor, id);
  assertCanEdit(actor, note);
  await Note.updateOne({ _id: note._id }, { pinned }, { timestamps: false });
  return { _id: note._id, pinned };
}

export async function deleteNote(actor: Actor, id: string) {
  const note = await findVisible(actor, id);
  assertCanEdit(actor, note);
  await Note.updateOne({ _id: note._id }, { deletedAt: new Date() }, { timestamps: false });
  await audit(actor, {
    action: "note.delete",
    entityType: "Note",
    entityId: note._id,
    summary: note.title,
  });
}

export async function listVersions(actor: Actor, id: string) {
  const note = await findVisible(actor, id);
  return NoteVersion.find({ note: note._id })
    .select("title editedBy editedAt createdAt")
    .sort({ createdAt: -1 })
    .populate(populateUser("editedBy"))
    .lean();
}

export async function getVersion(actor: Actor, id: string, versionId: string) {
  const note = await findVisible(actor, id);
  return assertFound(
    await NoteVersion.findOne({ _id: versionId, note: note._id })
      .populate(populateUser("editedBy"))
      .lean(),
    "Version",
  );
}

/** Restoring is itself an edit, so the content being replaced becomes a version too. */
export async function restoreVersion(actor: Actor, id: string, versionId: string) {
  const version = await getVersion(actor, id, versionId);
  return updateNote(actor, id, { title: version.title, content: version.content });
}

export async function mentionableUsers(query: string) {
  return User.find({
    status: "ACTIVE",
    ...(query ? { name: new RegExp(escapeRegex(query), "i") } : {}),
  })
    .select("name image designation")
    .sort({ name: 1 })
    .limit(8)
    .lean();
}

export async function uploadImage(actor: Actor, file: Express.Multer.File | undefined) {
  if (!file) throw AppError.badRequest("An image is required");
  if (!IMAGE_TYPES.includes(file.mimetype))
    throw AppError.badRequest("Only PNG, JPEG, GIF and WebP images can be added to notes");
  if (file.size > MAX_IMAGE_BYTES)
    throw AppError.badRequest(`Images must be ${MAX_IMAGE_BYTES / 1024 / 1024} MB or smaller`);
  assertAllowedFile(file.buffer, file.mimetype);
  const name = path
    .basename(file.originalname)
    .replace(/[^\w.\- ()]/g, "_")
    .slice(0, 200);
  const stored = await storeFile(file.buffer, name || "image", file.mimetype);
  const image = await NoteImage.create({
    ...stored,
    mimeType: file.mimetype,
    size: file.size,
    uploadedBy: actor.id,
  });
  return { _id: image._id, src: `/api/v1/notes/images/${image._id}` };
}

/** An image is viewable by its uploader, or by anyone who can see a note (or version) using it. */
export async function canViewImage(actor: Actor, id: string) {
  const image = await NoteImage.findById(id).select("uploadedBy").lean();
  if (!image) return false;
  if (String(image.uploadedBy) === actor.id) return true;
  if (await Note.exists({ $and: [{ images: image._id }, visibleNotes(actor)] })) return true;
  const notes = await NoteVersion.distinct("note", { images: image._id });
  return Boolean(
    notes.length && (await Note.exists({ $and: [{ _id: { $in: notes } }, visibleNotes(actor)] })),
  );
}

export async function findViewableImage(actor: Actor, id: string) {
  if (!(await canViewImage(actor, id))) throw AppError.notFound("Image");
  return assertFound(await NoteImage.findById(id).lean(), "Image");
}

export const openLocalImage = (storageKey: string) => readLocalFile(storageKey);

/** Loads embedded PNG and JPEG images for the PDF; pdfkit cannot draw other formats. */
export async function loadImagesForPdf(ids: string[]) {
  const images = await NoteImage.find({
    _id: { $in: ids },
    mimeType: { $in: ["image/png", "image/jpeg"] },
  }).lean();
  const buffers = new Map<string, Buffer>();
  await Promise.all(
    images.map(async (image) => {
      try {
        if (image.driver === "local") {
          buffers.set(
            String(image._id),
            await readFile(path.join(env.UPLOAD_DIR, path.basename(image.storageKey))),
          );
        } else {
          const response = await fetch(image.url, { signal: AbortSignal.timeout(10_000) });
          if (response.ok)
            buffers.set(String(image._id), Buffer.from(await response.arrayBuffer()));
        }
      } catch {
        // A missing image is left out of the PDF rather than failing the export.
      }
    }),
  );
  return buffers;
}
