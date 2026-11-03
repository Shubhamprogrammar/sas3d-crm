import { pino } from "pino";
import { env, isTest } from "./env.js";

export const logger = pino({
  level: isTest ? "silent" : env.LOG_LEVEL,
  redact: ["req.headers.cookie", "req.headers.authorization", "password", "*.password"],
});
