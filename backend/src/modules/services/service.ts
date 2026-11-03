import type { z } from "zod";
import { audit } from "../../services/audit.service.js";
import { assertFound } from "../../services/scope.service.js";
import type { Actor } from "../../types/express.js";
import { paginate, searchFilter } from "../../utils/query.js";
import { Service } from "./model.js";
import type { createServiceSchema, listServicesSchema, updateServiceSchema } from "./validator.js";

export function listServices(query: z.infer<typeof listServicesSchema>) {
  return paginate(
    Service,
    {
      $and: [
        searchFilter(["name", "description"], query.search),
        ...(query.category ? [{ category: query.category }] : []),
        ...(query.active ? [{ isActive: query.active === "true" }] : []),
      ],
    },
    { page: query.page, limit: query.limit, sort: { name: 1 } },
  );
}

export const getService = async (id: string) =>
  assertFound(await Service.findById(id).lean(), "Service");

export async function createService(actor: Actor, input: z.infer<typeof createServiceSchema>) {
  const service = await Service.create({ ...input, createdBy: actor.id, updatedBy: actor.id });
  await audit(actor, {
    action: "service.create",
    entityType: "Service",
    entityId: service._id,
    summary: service.name,
  });
  return service;
}

export async function updateService(
  actor: Actor,
  id: string,
  input: z.infer<typeof updateServiceSchema>,
) {
  const service = assertFound(await Service.findById(id), "Service");
  service.set({ ...input, updatedBy: actor.id });
  await service.save();
  await audit(actor, {
    action: "service.update",
    entityType: "Service",
    entityId: service._id,
    summary: service.name,
  });
  return service;
}

/** Services are referenced by historical documents, so "delete" means deactivate. */
export async function deactivateService(actor: Actor, id: string) {
  return updateService(actor, id, { isActive: false });
}
