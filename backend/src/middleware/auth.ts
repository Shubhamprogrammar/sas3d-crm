import type { NextFunction, Request, Response } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { getAuth } from "../config/auth.js";
import { hasPermission, type Permission } from "../config/permissions.js";
import type { Role } from "../config/constants.js";
import { User } from "../modules/users/model.js";
import { AppError } from "../utils/http.js";
import type { Actor } from "../types/express.js";

/**
 * Verifies the Better Auth session against the database on every request, then reloads the user so
 * that role changes and deactivation take effect immediately rather than when the session expires.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const session = await getAuth().api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session) throw AppError.unauthorized();

  const user = await User.findById(session.user.id).select("name email role status").lean();
  if (!user) throw AppError.unauthorized();
  if (user.status !== "ACTIVE") throw AppError.forbidden("This account has been deactivated");

  req.actor = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role as Role,
    ip: req.ip ?? "",
  };
  next();
}

export const requirePermission =
  (...permissions: Permission[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const actor = actorOf(req);
    if (!permissions.every((permission) => hasPermission(actor.role, permission))) {
      throw AppError.forbidden();
    }
    next();
  };

export function actorOf(req: Request): Actor {
  if (!req.actor) throw AppError.unauthorized();
  return req.actor;
}
