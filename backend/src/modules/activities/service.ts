import type { z } from "zod";
import { hasGlobalScope } from "../../config/permissions.js";
import { toObjectId, withTransaction } from "../../database/connection.js";
import { assertFound, clientScope, leadScope, projectScope } from "../../services/scope.service.js";
import type { Actor } from "../../types/express.js";
import { paginate, populateUser, searchFilter } from "../../utils/query.js";
import { Client } from "../clients/model.js";
import { Lead } from "../leads/model.js";
import { Opportunity } from "../opportunities/model.js";
import { Project } from "../projects/model.js";
import { Task } from "../tasks/model.js";
import { Activity } from "./model.js";
import type { listActivitiesSchema, logCommunicationSchema } from "./validator.js";

async function assertLeadVisible(actor: Actor, id: string) {
  assertFound(await Lead.exists({ $and: [{ _id: id }, leadScope(actor)] }), "Lead");
}
async function assertClientVisible(actor: Actor, id: string) {
  assertFound(await Client.exists({ $and: [{ _id: id }, await clientScope(actor)] }), "Client");
}

export async function listActivities(actor: Actor, query: z.infer<typeof listActivitiesSchema>) {
  const relation: Record<string, unknown> = {};
  if (query.lead) {
    await assertLeadVisible(actor, query.lead);
    relation.lead = toObjectId(query.lead);
  }
  if (query.client) {
    await assertClientVisible(actor, query.client);
    relation.client = toObjectId(query.client);
  }
  if (query.project) {
    assertFound(
      await Project.exists({ $and: [{ _id: query.project }, projectScope(actor)] }),
      "Project",
    );
    relation.project = toObjectId(query.project);
  }
  // With no record to authorise against, non-admins see only their own actions.
  const scope =
    Object.keys(relation).length || hasGlobalScope(actor.role)
      ? {}
      : { actor: toObjectId(actor.id) };

  return paginate(
    Activity,
    {
      $and: [
        scope,
        relation,
        searchFilter(["subject", "description"], query.search),
        ...(query.kind ? [{ kind: query.kind }] : []),
        ...(query.commType ? [{ commType: query.commType }] : []),
      ],
    },
    {
      page: query.page,
      limit: query.limit,
      sort: { occurredAt: -1 },
      populate: [populateUser("actor")],
    },
  );
}

/**
 * Manual logging entry point. Future Gmail, email-provider or WhatsApp adapters should call this
 * with their own `channel` and `externalId`, so synced messages join the same timeline.
 */
export async function logCommunication(
  actor: Actor,
  input: z.infer<typeof logCommunicationSchema>,
  source: { channel: string; externalId?: string } = { channel: "manual" },
) {
  if (input.lead) await assertLeadVisible(actor, input.lead);
  if (input.client) await assertClientVisible(actor, input.client);
  const occurredAt = input.occurredAt ?? new Date();

  return withTransaction(async (session) => {
    const [activity] = await Activity.create(
      [
        {
          ...input,
          ...source,
          kind: "COMMUNICATION",
          action: "communication.logged",
          occurredAt,
          actor: actor.id,
          entityType: input.lead ? "LEAD" : "CLIENT",
          entityId: input.lead ?? input.client,
        },
      ],
      { session },
    );
    if (!activity) throw new Error("Activity was not created");

    const isContact = input.commType !== "INTERNAL_NOTE";
    if (input.lead) {
      await Lead.updateOne(
        { _id: input.lead },
        {
          $set: {
            ...(isContact ? { lastContactedAt: occurredAt } : {}),
            ...(input.nextFollowUpAt !== undefined ? { nextFollowUpAt: input.nextFollowUpAt } : {}),
          },
        },
        { session },
      );
      if (input.nextFollowUpAt !== undefined) {
        await Opportunity.updateOne(
          { lead: input.lead },
          { $set: { nextFollowUpAt: input.nextFollowUpAt } },
          { session },
        );
      }
    }
    if (input.client) {
      await Client.updateOne(
        { _id: input.client },
        { $set: { lastInteractionAt: occurredAt } },
        { session },
      );
      // Clients have no follow-up field, so the reminder becomes a task the scheduler already tracks.
      if (input.nextFollowUpAt && !input.lead) {
        await Task.create(
          [
            {
              title: `Follow up: ${input.subject}`,
              client: input.client,
              assignedTo: actor.id,
              dueAt: input.nextFollowUpAt,
              hasDueTime: true,
              createdBy: actor.id,
              updatedBy: actor.id,
            },
          ],
          { session },
        );
      }
    }
    return activity;
  });
}
