import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { AppError } from "../utils/http.js";

export interface StoredFile {
  driver: "local" | "cloudinary";
  storageKey: string;
  url: string;
}

async function uploadCloudinary(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<StoredFile> {
  const {
    CLOUDINARY_CLOUD_NAME: cloud,
    CLOUDINARY_API_KEY: key,
    CLOUDINARY_API_SECRET: secret,
  } = env;
  if (!cloud || !key || !secret) throw new AppError(503, "Cloudinary storage is not configured");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const publicId = `sas3d-crm/${randomUUID()}`;
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${secret}`)
    .digest("hex");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
  form.append("api_key", key);
  form.append("timestamp", timestamp);
  form.append("public_id", publicId);
  form.append("signature", signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/auto/upload`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) throw new AppError(502, "The file storage provider rejected the upload");
  const body = (await response.json()) as { secure_url: string; public_id: string };
  return { driver: "cloudinary", storageKey: body.public_id, url: body.secure_url };
}

export async function storeFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<StoredFile> {
  if (env.STORAGE_DRIVER === "cloudinary") return uploadCloudinary(buffer, filename, mimeType);
  await mkdir(env.UPLOAD_DIR, { recursive: true });
  // The stored name never derives from user input, which rules out path traversal.
  const storageKey = randomUUID();
  await writeFile(path.join(env.UPLOAD_DIR, storageKey), buffer);
  return { driver: "local", storageKey, url: "" };
}

export const readLocalFile = (storageKey: string) =>
  createReadStream(path.join(env.UPLOAD_DIR, path.basename(storageKey)));

export const removeLocalFile = (storageKey: string) =>
  unlink(path.join(env.UPLOAD_DIR, path.basename(storageKey))).catch(() => undefined);

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const SIGNATURES: Record<string, number[] | null> = {
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/gif": [0x47, 0x49, 0x46, 0x38],
  "image/webp": [0x52, 0x49, 0x46, 0x46],
  "application/zip": ZIP,
  "application/x-zip-compressed": ZIP,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ZIP,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ZIP,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ZIP,
  "text/plain": null,
  "text/csv": null,
  "text/markdown": null,
};

/** Validates declared type against an allowlist and the file's actual leading bytes. */
export function assertAllowedFile(buffer: Buffer, mimeType: string) {
  if (!(mimeType in SIGNATURES))
    throw AppError.badRequest(`Files of type ${mimeType} are not allowed`);
  const signature = SIGNATURES[mimeType];
  const valid = signature
    ? signature.every((byte, index) => buffer[index] === byte)
    : !buffer.subarray(0, 8192).includes(0);
  if (!valid) throw AppError.badRequest("The file's contents do not match its type");
}
