import type { ClientSession, Types } from "mongoose";
import type { z } from "zod";
import { PIPELINE_STAGES, type PipelineStage } from "../../config/constants.js";
import { toObjectId, withTransaction } from "../../database/connection.js";
import { logActivity } from "../../services/activity.service.js";
import { audit } from "../../services/audit.service.js";
import { assertFound, opportunityScope } from "../../services/scope.service.js";
import type { Actor } from "../../types/express.js";
import { AppError } from "../../utils/http.js";
import { populateNamed, populateUser, searchFilter } from "../../utils/query.js";
import { assertClientAccess, findOrCreateClientFromLead } from "../clients/service.js";
import { Client } from "../clients/model.js";
import { Lead } from "../leads/model.js";
import { createProjectInTx } from "../projects/service.js";
import { Opportunity, StageHistory } from "./model.js";
import { assertTransition, conversionRate, shouldAutoAdvance } from "./transitions.js";
import type {
  boardQuerySchema,
  convertSchema,
  createOpportunitySchema,
  moveSchema,
  updateOpportunitySchema,
} from "./validator.js";

const CARD_POPULATE = [populateUser("assignedTo"), populateNamed("service", "name")];

export async function getBoard(actor: Actor, query: z.infer<typeof boardQuerySchema>) {
  const filter = {
    $and: [
      opportunityScope(actor),
      { archivedAt: null },
      searchFilter(["title", "contactName", "companyName", "country"], query.search),
      ...(query.assignedTo ? [{ assignedTo: toObjectId(query.assignedTo) }] : []),
      ...(query.priority ? [{ priority: query.priority }] : []),
      ...(query.country ? [{ country: query.country }] : []),
      ...(query.service ? [{ service: toObjectId(query.service) }] : []),
    ],
  };
  const cards = await Opportunity.find(filter)
    .sort({ stageChangedAt: -1 })
    .limit(1000)
    .populate(CARD_POPULATE)
    .lean();

  const columns = PIPELINE_STAGES.map((stage) => {
    const stageCards = cards.filter((card) => card.stage === stage);
    // Deal values stay per-currency: adding USD and INR into one figure would be meaningless.
    const totals = new Map<string, number>();
    for (const card of stageCards)
      totals.set(card.currency, (totals.get(card.currency) ?? 0) + (card.value ?? 0));
    return {
      stage,
      count: stageCards.length,
      totals: [...totals].map(([currency, amount]) => ({ currency, amount })),
      cards: stageCards,
    };
  });
  const count = (stage: PipelineStage) => columns.find((c) => c.stage === stage)?.count ?? 0;
  return { columns, conversionRate: conversionRate(count("WON"), count("LOST")) };
}

export async function getOpportunity(actor: Actor, id: string) {
  const opportunity = await Opportunity.findOne({ _id: id, ...opportunityScope(actor) })
    .populate(CARD_POPULATE)
    .populate("client", "name companyName")
    .populate("project", "name code")
    .lean();
  const found = assertFound(opportunity, "Opportunity");
  const history = await StageHistory.find({ opportunity: id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate(populateUser("changedBy"))
    .lean();
  return { ...found, history };
}

/**
 * The stage guard in the query makes this a compare-and-swap: when two people drag the same card,
 * the second gets a 409 rather than silently recording a false transition in the history.
 */
async function applyStage(
  actor: Actor | null,
  opportunityId: Types.ObjectId,
  from: PipelineStage,
  to: PipelineStage,
  lostReason: string | undefined,
  session: ClientSession,
) {
  const now = new Date();
  const updated = await Opportunity.findOneAndUpdate(
    { _id: opportunityId, stage: from },
    {
      $set: {
        stage: to,
        stageChangedAt: now,
        wonAt: to === "WON" ? now : null,
        lostAt: to === "LOST" ? now : null,
        lostReason: to === "LOST" ? lostReason?.trim() : "",
        updatedBy: actor?.id ?? null,
      },
    },
    { returnDocument: "after", session },
  );
  if (!updated)
    throw AppError.conflict("This opportunity was changed by someone else. Refresh and try again.");

  await StageHistory.create(
    [
      {
        opportunity: updated._id,
        from,
        to,
        reason: lostReason ?? "",
        changedBy: actor?.id ?? null,
      },
    ],
    { session },
  );
  if (updated.lead)
    await Lead.updateOne({ _id: updated.lead }, { $set: { status: to } }, { session });
  await logActivity(
    actor,
    {
      action: "opportunity.stage_changed",
      description: `${updated.title} moved from ${from} to ${to}${to === "LOST" && lostReason ? `: ${lostReason}` : ""}`,
      entityType: "OPPORTUNITY",
      entityId: updated._id,
      lead: updated.lead,
      client: updated.client,
    },
    session,
  );
  if (actor) {
    await audit(
      actor,
      {
        action: "opportunity.move",
        entityType: "Opportunity",
        entityId: updated._id,
        before: { stage: from },
        after: { stage: to },
      },
      session,
    );
  }
  return updated;
}

export async function moveOpportunity(actor: Actor, id: string, input: z.infer<typeof moveSchema>) {
  return withTransaction(async (session) => {
    const current = assertFound(
      await Opportunity.findOne({ _id: id, ...opportunityScope(actor), archivedAt: null }).session(
        session,
      ),
      "Opportunity",
    );
    const from = current.stage as PipelineStage;
    assertTransition(from, input.to, {
      lostReason: input.lostReason,
      hasProject: Boolean(current.project),
    });
    return applyStage(actor, current._id, from, input.to, input.lostReason, session);
  });
}

/** Used by proposal events; quietly does nothing when the move would not be an advance. */
export async function autoAdvanceOpportunity(
  actor: Actor,
  opportunityId: Types.ObjectId | null | undefined,
  to: PipelineStage,
  session: ClientSession,
) {
  if (!opportunityId) return;
  const current = await Opportunity.findById(opportunityId).session(session);
  if (!current || !shouldAutoAdvance(current.stage as PipelineStage, to)) return;
  await applyStage(actor, current._id, current.stage as PipelineStage, to, undefined, session);
}

export async function createOpportunity(
  actor: Actor,
  input: z.infer<typeof createOpportunitySchema>,
) {
  const client = await assertClientAccess(actor, input.client);
  return withTransaction(async (session) => {
    const [opportunity] = await Opportunity.create(
      [
        {
          assignedTo: actor.id,
          ...input,
          contactName: client.name,
          companyName: client.companyName,
          country: client.country,
          createdBy: actor.id,
        },
      ],
      { session },
    );
    if (!opportunity) throw new Error("Opportunity was not created");
    await StageHistory.create(
      [{ opportunity: opportunity._id, from: null, to: "NEW", changedBy: actor.id }],
      { session },
    );
    await audit(
      actor,
      {
        action: "opportunity.create",
        entityType: "Opportunity",
        entityId: opportunity._id,
        summary: opportunity.title,
      },
      session,
    );
    return opportunity;
  });
}

export async function updateOpportunity(
  actor: Actor,
  id: string,
  input: z.infer<typeof updateOpportunitySchema>,
) {
  const opportunity = assertFound(
    await Opportunity.findOne({ _id: id, ...opportunityScope(actor) }),
    "Opportunity",
  );
  opportunity.set({ ...input, updatedBy: actor.id });
  await opportunity.save();
  await audit(actor, {
    action: "opportunity.update",
    entityType: "Opportunity",
    entityId: opportunity._id,
    summary: opportunity.title,
  });
  return opportunity;
}

/**
 * Converts a WON opportunity to a client and, on request, a project. Safe to repeat: existing links
 * are reused, and the unique indexes on Client.sourceLead and Project.opportunity stop concurrent
 * attempts from creating a second copy.
 */
export async function convertOpportunity(
  actor: Actor,
  id: string,
  input: z.infer<typeof convertSchema>,
) {
  return withTransaction(async (session) => {
    const opportunity = assertFound(
      await Opportunity.findOne({ _id: id, ...opportunityScope(actor), archivedAt: null }).session(
        session,
      ),
      "Opportunity",
    );
    if (opportunity.stage !== "WON")
      throw AppError.conflict("Only a WON opportunity can be converted");

    let client = opportunity.client
      ? await Client.findById(opportunity.client).session(session)
      : null;
    if (!client && opportunity.lead) {
      const lead = assertFound(await Lead.findById(opportunity.lead).session(session), "Lead");
      client = await findOrCreateClientFromLead(actor, lead, session);
    }
    if (!client) throw AppError.conflict("This opportunity has no lead or client to convert");
    opportunity.client = client._id;

    let projectId = opportunity.project;
    if (!projectId && input.createProject !== false) {
      const project = await createProjectInTx(
        actor,
        {
          name: opportunity.title,
          budget: opportunity.value,
          currency: opportunity.currency,
          priority: opportunity.priority,
          ...input.project,
          client: String(client._id),
          opportunity: String(opportunity._id),
        },
        session,
      );
      projectId = project._id;
      opportunity.project = project._id;
    }
    await opportunity.save({ session });
    return { opportunity, clientId: client._id, projectId };
  });
}
