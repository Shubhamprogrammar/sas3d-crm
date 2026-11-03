import type { NextFunction, Request, Response } from "express";
import { allowedOrigins } from "../config/env.js";
import { AppError } from "../utils/http.js";

function hasOperatorKey(value: unknown, depth = 0): boolean {
  if (depth > 20 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => hasOperatorKey(item, depth + 1));
  return Object.entries(value).some(
    ([key, nested]) =>
      key.includes("$") ||
      key.includes(".") ||
      key === "__proto__" ||
      hasOperatorKey(nested, depth + 1),
  );
}

/**
 * NoSQL injection guard. Rejects any Mongo-style operator key in the input outright. Zod schemas
 * are the second layer, as they only accept scalar strings for filter values.
 */
export function rejectMongoOperators(req: Request, _res: Response, next: NextFunction) {
  if (hasOperatorKey(req.body) || hasOperatorKey(req.query)) {
    throw AppError.badRequest("Request contains forbidden keys");
  }
  next();
}

/**
 * CSRF defence in depth on top of SameSite cookies: a browser always sends Origin on cross-site
 * writes, so any write from an origin outside the allowlist is refused.
 */
export function rejectCrossOriginWrites(req: Request, _res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    origin &&
    !allowedOrigins.includes(origin)
  ) {
    throw AppError.forbidden("Cross-origin request refused");
  }
  next();
}
