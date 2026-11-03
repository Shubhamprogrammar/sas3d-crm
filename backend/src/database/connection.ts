import mongoose from "mongoose";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export async function connectDatabase(uri = env.MONGODB_URI) {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  logger.info({ db: mongoose.connection.name }, "MongoDB connected");
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

/** Runs `work` in a transaction with automatic retries. Requires a replica set: docs/DATABASE.md. */
export async function withTransaction<T>(work: (session: mongoose.ClientSession) => Promise<T>) {
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(() => work(session));
  } finally {
    await session.endSession();
  }
}

export const toObjectId = (id: string | mongoose.Types.ObjectId) => new mongoose.Types.ObjectId(id);
