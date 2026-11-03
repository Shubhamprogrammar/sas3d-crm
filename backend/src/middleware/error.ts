import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { ZodError } from "zod";
import { isProduction } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/http.js";

export function notFoundHandler(req: Request, res: Response) {
  res
    .status(404)
    .json({ success: false, message: `Route not found: ${req.method} ${req.path}`, errors: [] });
}

const fail = (res: Response, status: number, message: string, errors: unknown[] = []) =>
  res.status(status).json({ success: false, message, errors });

// Express identifies error handlers by their four-argument signature.
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) return fail(res, error.statusCode, error.message, error.errors);
  if (error instanceof ZodError) {
    const errors = error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return fail(res, 422, "Please correct the highlighted fields", errors);
  }
  if (error instanceof mongoose.Error.ValidationError) {
    const errors = Object.values(error.errors).map((e) => ({ path: e.path, message: e.message }));
    return fail(res, 422, "Please correct the highlighted fields", errors);
  }
  if (error instanceof mongoose.Error.CastError) return fail(res, 400, "Invalid identifier");
  if (error instanceof multer.MulterError) return fail(res, 400, error.message);
  if (error instanceof RangeError) return fail(res, 422, error.message);
  if (error instanceof SyntaxError && "body" in error) return fail(res, 400, "Malformed JSON body");
  if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
    return fail(res, 409, "A record with the same unique value already exists");
  }

  logger.error({ err: error, path: req.path, method: req.method }, "Unhandled error");
  return fail(
    res,
    500,
    isProduction || !(error instanceof Error) ? "Something went wrong" : error.message,
  );
}
