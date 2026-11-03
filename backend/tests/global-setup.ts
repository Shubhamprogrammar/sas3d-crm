import { existsSync } from "node:fs";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

/** A real single-node replica set, because transactions are part of what is being tested. */
export default async function setup(project: TestProject) {
  const systemBinary =
    process.env.MONGOMS_SYSTEM_BINARY ??
    (existsSync("/usr/bin/mongod") ? "/usr/bin/mongod" : undefined);
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    binary: systemBinary ? { systemBinary } : undefined,
  });
  project.provide("mongoUri", replSet.getUri("sas3d_test"));
  return () => replSet.stop();
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
