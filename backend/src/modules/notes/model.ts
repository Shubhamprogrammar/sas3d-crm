import { Schema, model } from "mongoose";
import { ref } from "../../database/schema-helpers.js";

export const NOTE_VISIBILITIES = ["PRIVATE", "TEAM"] as const;

/**
 * A free-standing rich-text note. `content` is server-sanitised HTML; `contentText`, `mentions`
 * and `images` are always derived from it on the server, never accepted from the client.
 */
const noteSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    content: { type: String, default: "" },
    contentText: { type: String, default: "" },
    tags: { type: [String], default: [] },
    pinned: { type: Boolean, default: false },
    visibility: { type: String, enum: NOTE_VISIBILITIES, default: "PRIVATE" },
    mentions: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    // Users already notified, so re-saving a note never notifies the same person twice.
    notifiedMentions: { type: [Schema.Types.ObjectId], default: [] },
    images: { type: [Schema.Types.ObjectId], default: [] },
    createdBy: ref("User"),
    updatedBy: ref("User"),
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
noteSchema.index({ createdBy: 1, deletedAt: 1, pinned: -1, updatedAt: -1 });
noteSchema.index({ visibility: 1, deletedAt: 1, pinned: -1, updatedAt: -1 });
noteSchema.index({ tags: 1 });
noteSchema.index({ images: 1 });

export const Note = model("Note", noteSchema);

/** Snapshot of a note's title and content taken just before each edit. */
const noteVersionSchema = new Schema(
  {
    note: ref("Note", { required: true }),
    title: { type: String, required: true },
    content: { type: String, default: "" },
    contentText: { type: String, default: "" },
    images: { type: [Schema.Types.ObjectId], default: [] },
    editedBy: ref("User"),
    // When this snapshot's content was originally written.
    editedAt: { type: Date, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
noteVersionSchema.index({ note: 1, createdAt: -1 });
noteVersionSchema.index({ images: 1 });

export const NoteVersion = model("NoteVersion", noteVersionSchema);

/** An image pasted or dropped into a note, served through an access-checked route. */
const noteImageSchema = new Schema(
  {
    driver: { type: String, enum: ["local", "cloudinary"], required: true },
    storageKey: { type: String, required: true },
    url: { type: String, default: "" },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: ref("User"),
  },
  { timestamps: true },
);

export const NoteImage = model("NoteImage", noteImageSchema);
