import type { ClientSession, Types } from "mongoose";
import type { NotificationType, RelatedType } from "../config/constants.js";
import { Notification } from "../modules/notifications/model.js";
import { User } from "../modules/users/model.js";

type Id = Types.ObjectId | string | null | undefined;

export interface NotificationInput {
  recipient: Id;
  type: NotificationType;
  title: string;
  message?: string;
  link?: string;
  entityType?: RelatedType;
  entityId?: Id;
  /** When set, a second notification with the same key is silently skipped. */
  dedupeKey?: string;
}

export async function notify(input: NotificationInput, session?: ClientSession) {
  const { recipient, dedupeKey } = input;
  if (!recipient) return;
  const muted = await User.exists({ _id: recipient, mutedNotifications: input.type }).session(
    session ?? null,
  );
  if (muted) return;

  const data = { ...input, recipient };
  if (dedupeKey) {
    await Notification.updateOne(
      { dedupeKey },
      { $setOnInsert: { ...data, readAt: null } },
      { upsert: true, session },
    );
    return;
  }
  await Notification.create([data], { session });
}

export const notifyMany = async (
  recipients: Id[],
  input: Omit<NotificationInput, "recipient">,
  session?: ClientSession,
) => {
  const unique = [...new Set(recipients.filter(Boolean).map(String))];
  for (const recipient of unique) {
    await notify(
      { ...input, recipient, dedupeKey: input.dedupeKey && `${input.dedupeKey}:${recipient}` },
      session,
    );
  }
};
