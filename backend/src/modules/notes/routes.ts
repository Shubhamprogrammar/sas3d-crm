import { Router, type Request, type Response } from "express";
import multer from "multer";
import { actorOf, requirePermission as can } from "../../middleware/auth.js";
import { sendOk } from "../../utils/http.js";
import { idParam } from "../../utils/query.js";
import { notePdf } from "./pdf.js";
import * as service from "./service.js";
import {
  createNoteSchema,
  listNotesSchema,
  mentionQuery,
  pinNoteSchema,
  updateNoteSchema,
  versionParams,
} from "./validator.js";

const id = (req: Request) => idParam.parse(req.params).id;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});

export const noteRoutes = Router();

noteRoutes.get("/", can("note:read"), async (req, res) => {
  const { items, meta } = await service.listNotes(actorOf(req), listNotesSchema.parse(req.query));
  sendOk(res, items, { meta });
});
noteRoutes.get("/tags", can("note:read"), async (req, res) => {
  sendOk(res, await service.listTags(actorOf(req)));
});
noteRoutes.get("/mentionable", can("note:read"), async (req, res) => {
  sendOk(res, await service.mentionableUsers(mentionQuery.parse(req.query).q));
});
noteRoutes.post("/", can("note:write"), async (req, res) => {
  const note = await service.createNote(actorOf(req), createNoteSchema.parse(req.body));
  sendOk(res, note, { status: 201, message: "Note created" });
});

noteRoutes.post("/images", can("note:write"), upload.single("file"), async (req, res) => {
  sendOk(res, await service.uploadImage(actorOf(req), req.file), {
    status: 201,
    message: "Image uploaded",
  });
});
noteRoutes.get("/images/:id", can("note:read"), async (req: Request, res: Response) => {
  const image = await service.findViewableImage(actorOf(req), id(req));
  res.setHeader("Cache-Control", "private, max-age=86400");
  if (image.driver === "cloudinary") return res.redirect(image.url);
  // Only signature-checked raster types are stored, so inline display cannot execute script.
  res.setHeader("Content-Type", image.mimeType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", "inline");
  service
    .openLocalImage(image.storageKey)
    .on("error", () => res.destroy())
    .pipe(res);
});

noteRoutes.get("/:id", can("note:read"), async (req, res) => {
  sendOk(res, await service.getNote(actorOf(req), id(req)));
});
noteRoutes.patch("/:id", can("note:write"), async (req, res) => {
  const note = await service.updateNote(actorOf(req), id(req), updateNoteSchema.parse(req.body));
  sendOk(res, note, { message: "Note saved" });
});
noteRoutes.patch("/:id/pin", can("note:write"), async (req, res) => {
  const { pinned } = pinNoteSchema.parse(req.body);
  sendOk(res, await service.pinNote(actorOf(req), id(req), pinned), {
    message: pinned ? "Note pinned" : "Note unpinned",
  });
});
noteRoutes.delete("/:id", can("note:write"), async (req, res) => {
  await service.deleteNote(actorOf(req), id(req));
  sendOk(res, null, { message: "Note deleted" });
});

noteRoutes.get("/:id/pdf", can("note:read"), async (req, res) => {
  const note = (await service.getNote(actorOf(req), id(req))) as unknown as Parameters<
    typeof notePdf
  >[0] & { images: unknown[] };
  const images = await service.loadImagesForPdf(note.images.map(String));
  const file = await notePdf(note, images);
  const filename =
    note.title
      .replace(/[^\w\- ]+/g, "")
      .trim()
      .slice(0, 80) || "note";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}.pdf"`);
  res.send(file);
});

noteRoutes.get("/:id/versions", can("note:read"), async (req, res) => {
  sendOk(res, await service.listVersions(actorOf(req), id(req)));
});
noteRoutes.get("/:id/versions/:versionId", can("note:read"), async (req, res) => {
  const params = versionParams.parse(req.params);
  sendOk(res, await service.getVersion(actorOf(req), params.id, params.versionId));
});
noteRoutes.post("/:id/versions/:versionId/restore", can("note:write"), async (req, res) => {
  const params = versionParams.parse(req.params);
  sendOk(res, await service.restoreVersion(actorOf(req), params.id, params.versionId), {
    message: "Version restored",
  });
});
