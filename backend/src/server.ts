import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDatabase, disconnectDatabase } from "./database/connection.js";
import { initDatabase } from "./database/models.js";
import { startScheduler } from "./services/jobs.service.js";

async function main() {
  await connectDatabase();
  await initDatabase();

  const server = createApp().listen(env.PORT, () =>
    logger.info({ port: env.PORT }, "API listening"),
  );
  const stopScheduler = startScheduler();

  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    stopScheduler();
    server.close(() => {
      void disconnectDatabase().finally(() => process.exit(0));
    });
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, "Failed to start");
  process.exit(1);
});
