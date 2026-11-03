import type { ClientSession, Types } from "mongoose";
import type { RelatedType } from "../config/constants.js";
import { Activity } from "../modules/activities/model.js";
import { Client } from "../modules/clients/model.js";
import type { Actor } from "../types/express.js";

type Id = Types.ObjectId | string | null;

export async function logActivity(
  actor: Actor | null,
  entry: {
    action: string;
    description: string;
    entityType: RelatedType;
    entityId: Id;
    lead?: Id;
    client?: Id;
    project?: Id;
  },
  session?: ClientSession,
) {
  await Activity.create(
    [{ kind: "SYSTEM", actor: actor?.id ?? null, occurredAt: new Date(), ...entry }],
    { session },
  );
  if (entry.client) {
    await Client.updateOne(
      { _id: entry.client },
      { $set: { lastInteractionAt: new Date() } },
      { session, timestamps: false },
    );
  }
}
