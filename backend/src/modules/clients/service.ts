import mongoose, { type ClientSession, type HydratedDocument } from "mongoose";
import type { z } from "zod";
import { logActivity } from "../../services/activity.service.js";
import { audit } from "../../services/audit.service.js";
import { assertFound, clientScope } from "../../services/scope.service.js";
import type { Actor } from "../../types/express.js";
import { paginate, populateUser, searchFilter } from "../../utils/query.js";
import { Invoice } from "../invoices/model.js";
import type { Lead } from "../leads/model.js";
import { Opportunity } from "../opportunities/model.js";
import { Payment } from "../payments/model.js";
import { Project } from "../projects/model.js";
import { Client } from "./model.js";
import type { createClientSchema, listClientsSchema, updateClientSchema } from "./validator.js";

export async function listClients(actor: Actor, query: z.infer<typeof listClientsSchema>) {
  return paginate(
    Client,
    {
      $and: [
        await clientScope(actor),
        searchFilter(["name", "companyName", "email", "phone", "country"], query.search),
        query.status ? { status: query.status } : { status: { $ne: "ARCHIVED" } },
        ...(query.type ? [{ type: query.type }] : []),
        ...(query.country ? [{ country: query.country }] : []),
      ],
    },
    {
      page: query.page,
      limit: query.limit,
      sort: { [query.sortBy ?? "createdAt"]: query.sortOrder === "asc" ? 1 : -1 },
      populate: [populateUser("relationshipManager")],
    },
  );
}

async function findScoped(actor: Actor, id: string, session?: ClientSession) {
  const client = await Client.findOne({ $and: [{ _id: id }, await clientScope(actor)] }).session(
    session ?? null,
  );
  return assertFound(client, "Client");
}

/** Throws 404 unless the actor may see this client. Other modules use it to guard related records. */
export const assertClientAccess = findScoped;

export async function getClient(actor: Actor, id: string) {
  const client = await findScoped(actor, id);
  await client.populate([
    populateUser("relationshipManager"),
    { path: "sourceLead", select: "fullName" },
  ]);
  return { ...client.toObject(), summary: await clientSummary(client._id) };
}

/** Financial totals are grouped by currency and never added across currencies. */
async function clientSummary(clientId: mongoose.Types.ObjectId) {
  const [totalProjects, activeProjects, billed, received] = await Promise.all([
    Project.countDocuments({ client: clientId, archivedAt: null }),
    Project.countDocuments({
      client: clientId,
      archivedAt: null,
      status: { $nin: ["COMPLETED", "CANCELLED", "DELIVERED"] },
    }),
    Invoice.aggregate<{ _id: string; billed: number; outstanding: number }>([
      { $match: { client: clientId, archivedAt: null, status: { $nin: ["DRAFT", "CANCELLED"] } } },
      {
        $group: {
          _id: "$currency",
          billed: { $sum: "$total" },
          outstanding: { $sum: "$amountDue" },
        },
      },
    ]),
    Payment.aggregate<{ _id: string; received: number }>([
      { $match: { client: clientId, voidedAt: null } },
      { $group: { _id: "$currency", received: { $sum: "$amount" } } },
    ]),
  ]);
  const currencies = [...new Set([...billed.map((b) => b._id), ...received.map((r) => r._id)])];
  return {
    totalProjects,
    activeProjects,
    financials: currencies.map((currency) => ({
      currency,
      billed: billed.find((b) => b._id === currency)?.billed ?? 0,
      outstanding: billed.find((b) => b._id === currency)?.outstanding ?? 0,
      received: received.find((r) => r._id === currency)?.received ?? 0,
    })),
  };
}

export async function createClient(actor: Actor, input: z.infer<typeof createClientSchema>) {
  const client = await Client.create({
    relationshipManager: actor.id,
    ...input,
    createdBy: actor.id,
    updatedBy: actor.id,
  });
  await logActivity(actor, {
    action: "client.created",
    description: `Client ${client.name} created`,
    entityType: "CLIENT",
    entityId: client._id,
    client: client._id,
  });
  await audit(actor, {
    action: "client.create",
    entityType: "Client",
    entityId: client._id,
    summary: client.name,
  });
  return client;
}

export async function updateClient(
  actor: Actor,
  id: string,
  input: z.infer<typeof updateClientSchema>,
) {
  const client = await findScoped(actor, id);
  client.set({ ...input, updatedBy: actor.id });
  await client.save();
  await audit(actor, {
    action: "client.update",
    entityType: "Client",
    entityId: client._id,
    summary: client.name,
  });
  return client;
}

export async function archiveClient(actor: Actor, id: string) {
  const client = await findScoped(actor, id);
  client.status = "ARCHIVED";
  await client.save();
  await audit(actor, {
    action: "client.archive",
    entityType: "Client",
    entityId: client._id,
    summary: client.name,
  });
  return client;
}

type LeadDoc = HydratedDocument<mongoose.InferSchemaType<typeof Lead.schema>>;

/**
 * Converts a lead without creating duplicates: reuses the client from an earlier conversion, then
 * an existing client with the same email, and only then creates one. The unique index on
 * Client.sourceLead makes a racing second conversion fail and its transaction roll back.
 */
export async function findOrCreateClientFromLead(
  actor: Actor,
  lead: LeadDoc,
  session: ClientSession,
) {
  if (lead.convertedClient) {
    return assertFound(await Client.findById(lead.convertedClient).session(session), "Client");
  }

  let client = lead.email
    ? await Client.findOne({ email: lead.email, status: { $ne: "ARCHIVED" } }).session(session)
    : null;

  if (!client) {
    const [created] = await Client.create(
      [
        {
          name: lead.fullName,
          companyName: lead.companyName,
          type: lead.companyName ? "SMALL_BUSINESS" : "INDIVIDUAL",
          email: lead.email,
          phone: lead.phone,
          website: lead.website,
          country: lead.country,
          city: lead.city,
          timezone: lead.timezone,
          billingAddress: { city: lead.city, state: lead.state, country: lead.country },
          relationshipManager: lead.assignedTo ?? actor.id,
          sourceLead: lead._id,
          lastInteractionAt: new Date(),
          createdBy: actor.id,
          updatedBy: actor.id,
        },
      ],
      { session },
    );
    if (!created) throw new Error("Client was not created");
    client = created;
  }

  lead.convertedClient = client._id;
  lead.convertedAt = new Date();
  await lead.save({ session });
  await Opportunity.updateOne({ lead: lead._id }, { $set: { client: client._id } }, { session });

  await logActivity(
    actor,
    {
      action: "lead.converted",
      description: `Lead ${lead.fullName} converted to client ${client.name}`,
      entityType: "LEAD",
      entityId: lead._id,
      lead: lead._id,
      client: client._id,
    },
    session,
  );
  await audit(
    actor,
    {
      action: "lead.convert",
      entityType: "Lead",
      entityId: lead._id,
      summary: `Client ${client.name}`,
    },
    session,
  );
  return client;
}
