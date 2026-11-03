import type { QueryFilter } from "mongoose";
import { hasGlobalScope } from "../config/permissions.js";
import { Project } from "../modules/projects/model.js";
import type { Actor } from "../types/express.js";
import { toObjectId } from "../database/connection.js";
import { AppError } from "../utils/http.js";

/**
 * Record-level access rules, applied to every read and write of a scoped record. Queries that miss
 * the scope return 404 so a guessed identifier reveals nothing, which is the IDOR protection.
 */
type Filter = QueryFilter<unknown> & Record<string, unknown>;

const me = (actor: Actor) => toObjectId(actor.id);

export const leadScope = (actor: Actor): Filter =>
  hasGlobalScope(actor.role) ? {} : { $or: [{ assignedTo: me(actor) }, { createdBy: me(actor) }] };

export const opportunityScope = leadScope;

export function projectScope(actor: Actor): Filter {
  if (hasGlobalScope(actor.role) || actor.role === "FINANCE") return {};
  if (actor.role === "SALES") return { createdBy: me(actor) };
  if (actor.role === "PROJECT_MANAGER") {
    return { $or: [{ projectManager: me(actor) }, { team: me(actor) }, { createdBy: me(actor) }] };
  }
  return { team: me(actor) };
}

export async function clientScope(actor: Actor): Promise<Filter> {
  if (hasGlobalScope(actor.role) || actor.role === "FINANCE") return {};
  if (actor.role === "SALES") {
    return { $or: [{ relationshipManager: me(actor) }, { createdBy: me(actor) }] };
  }
  const clients = await Project.distinct("client", projectScope(actor));
  return { _id: { $in: clients } };
}

export const taskScope = (actor: Actor): Filter =>
  hasGlobalScope(actor.role) ? {} : { $or: [{ assignedTo: me(actor) }, { createdBy: me(actor) }] };

export const proposalScope = (actor: Actor): Filter =>
  hasGlobalScope(actor.role) || actor.role === "FINANCE" ? {} : { createdBy: me(actor) };

export function assertFound<T>(record: T, resource = "Record"): NonNullable<T> {
  if (!record) throw AppError.notFound(resource);
  return record;
}
