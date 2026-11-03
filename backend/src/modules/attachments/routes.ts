import { Router, type Request } from "express";
import multer from "multer";
import path from "node:path";
import { z } from "zod";
import { env } from "../../config/env.js";
import { hasGlobalScope } from "../../config/permissions.js";
import { actorOf, requirePermission as can } from "../../middleware/auth.js";
import { logActivity } from "../../services/activity.service.js";
import { audit } from "../../services/audit.service.js";
import { assertFound, clientScope, leadScope, projectScope } from "../../services/scope.service.js";
import {
  assertAllowedFile,
  readLocalFile,
  removeLocalFile,
  storeFile,
} from "../../services/storage.service.js";
import type { Actor } from "../../types/express.js";
import { AppError, sendOk } from "../../utils/http.js";
import { idParam, objectId, populateUser } from "../../utils/query.js";
import { Client } from "../clients/model.js";
import { Lead } from "../leads/model.js";
import { Project } from "../projects/model.js";
import { Attachment } from "./model.js";

const entityQuery = z.object({
  entityType: z.enum(["LEAD", "CLIENT", "PROJECT"]),
  entityId: objectId,
});

async function assertEntityAccess(actor: Actor, type: "LEAD" | "CLIENT" | "PROJECT", id: unknown) {
  const exists =
    type === "LEAD"
      ? await Lead.exists({ $and: [{ _id: id }, leadScope(actor)] })
      : type === "CLIENT"
        ? await Client.exists({ $and: [{ _id: id }, await clientScope(actor)] })
        : await Project.exists({ $and: [{ _id: id }, projectScope(actor)] });
  assertFound(exists, type.charAt(0) + type.slice(1).toLowerCase());
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
});

export const attachmentRoutes = Router();

attachmentRoutes.get("/", can("attachment:read"), async (req, res) => {
  const query = entityQuery.parse(req.query);
  await assertEntityAccess(actorOf(req), query.entityType, query.entityId);
  const items = await Attachment.find({ ...query, deletedAt: null })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate(populateUser("uploadedBy"))
    .lean();
  sendOk(res, items);
});

attachmentRoutes.post(
  "/",
  can("attachment:write"),
  upload.single("file"),
  async (req: Request, res) => {
    const actor = actorOf(req);
    const query = entityQuery.parse(req.body);
    await assertEntityAccess(actor, query.entityType, query.entityId);
    if (!req.file) throw AppError.badRequest("A file is required");
    assertAllowedFile(req.file.buffer, req.file.mimetype);

    const filename = path
      .basename(req.file.originalname)
      .replace(/[^\w.\- ()]/g, "_")
      .slice(0, 200);
    const stored = await storeFile(req.file.buffer, filename, req.file.mimetype);
    const attachment = await Attachment.create({
      ...query,
      ...stored,
      filename,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedBy: actor.id,
    });
    await logActivity(actor, {
      action: "attachment.uploaded",
      description: `File ${filename} uploaded`,
      entityType: query.entityType,
      entityId: query.entityId,
      lead: query.entityType === "LEAD" ? query.entityId : null,
      client: query.entityType === "CLIENT" ? query.entityId : null,
      project: query.entityType === "PROJECT" ? query.entityId : null,
    });
    sendOk(res, attachment, { status: 201, message: "File uploaded" });
  },
);

attachmentRoutes.get("/:id/download", can("attachment:read"), async (req, res) => {
  const attachment = assertFound(
    await Attachment.findOne({ _id: idParam.parse(req.params).id, deletedAt: null }),
    "File",
  );
  await assertEntityAccess(actorOf(req), attachment.entityType, attachment.entityId);
  if (attachment.driver === "cloudinary") return res.redirect(attachment.url);
  res.setHeader("Content-Type", attachment.mimeType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Always a download, so an uploaded file can never run in this origin.
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${attachment.filename.replace(/"/g, "")}"`,
  );
  readLocalFile(attachment.storageKey)
    .on("error", () => res.destroy())
    .pipe(res);
});

attachmentRoutes.delete("/:id", can("attachment:write"), async (req, res) => {
  const actor = actorOf(req);
  const attachment = assertFound(
    await Attachment.findOne({ _id: idParam.parse(req.params).id, deletedAt: null }),
    "File",
  );
  await assertEntityAccess(actor, attachment.entityType, attachment.entityId);
  if (!hasGlobalScope(actor.role) && String(attachment.uploadedBy) !== actor.id) {
    throw AppError.forbidden("Only the uploader or an administrator can delete this file");
  }
  attachment.deletedAt = new Date();
  await attachment.save();
  if (attachment.driver === "local") await removeLocalFile(attachment.storageKey);
  await audit(actor, {
    action: "attachment.delete",
    entityType: "Attachment",
    entityId: attachment._id,
    summary: attachment.filename,
  });
  sendOk(res, null, { message: "File deleted" });
});
