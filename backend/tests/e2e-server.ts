/** Starts the API on a clean database for Playwright. Refuses any database not named for e2e. */
import mongoose from "mongoose";
import { createApp } from "../src/app.js";
import { env } from "../src/config/env.js";
import { connectDatabase } from "../src/database/connection.js";
import { initDatabase } from "../src/database/models.js";
import { seedBase } from "../src/database/seed.js";

await connectDatabase();
if (!mongoose.connection.name.includes("e2e"))
  throw new Error("Refusing to reset a database not named for e2e");
await mongoose.connection.dropDatabase();
await initDatabase();
await seedBase();
createApp().listen(env.PORT);
