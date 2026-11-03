import type { Response } from "express";

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    public readonly errors: unknown[] = [],
  ) {
    super(message);
  }
  static badRequest = (message: string, errors?: unknown[]) => new AppError(400, message, errors);
  static unauthorized = (message = "Authentication required") => new AppError(401, message);
  static forbidden = (message = "You do not have permission to perform this action") =>
    new AppError(403, message);
  static notFound = (resource = "Record") => new AppError(404, `${resource} not found`);
  static conflict = (message: string, errors?: unknown[]) => new AppError(409, message, errors);
}

export function sendOk<T>(
  res: Response,
  data: T,
  options: { message?: string; meta?: Record<string, unknown>; status?: number } = {},
) {
  res.status(options.status ?? 200).json({
    success: true,
    message: options.message ?? "Operation completed successfully",
    data,
    meta: options.meta ?? {},
  });
}

export function sendCsv(res: Response, filename: string, csv: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(csv);
}
