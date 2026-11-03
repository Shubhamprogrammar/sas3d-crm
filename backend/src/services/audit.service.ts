import type { ClientSession, Types } from "mongoose";
import { AuditLog } from "../modules/audit/model.js";
import type { Actor } from "../types/express.js";

const toPlain = (value: unknown) =>
  value === undefined ? null : JSON.parse(JSON.stringify(value));

export async function audit(
  actor: Actor | null,
  entry: {
    action: string;
    entityType: string;
    entityId?: Types.ObjectId | string | null;
    summary?: string;
    before?: unknown;
    after?: unknown;
  },
  session?: ClientSession,
) {
  await AuditLog.create(
    [
      {
        actor: actor?.id ?? null,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        summary: entry.summary ?? "",
        before: toPlain(entry.before),
        after: toPlain(entry.after),
        ip: actor?.ip ?? "",
      },
    ],
    { session },
  );
}
