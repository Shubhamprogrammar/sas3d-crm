import type { ClientSession } from "mongoose";
import type { z } from "zod";
import { toObjectId, withTransaction } from "../../database/connection.js";
import { logActivity } from "../../services/activity.service.js";
import { audit } from "../../services/audit.service.js";
import { sendEmail } from "../../services/email.service.js";
import { notifyMany } from "../../services/notification.service.js";
import { nextDocumentNumber } from "../../services/numbering.service.js";
import { proposalPdf } from "../../services/pdf.service.js";
import {
  assertFound,
  clientScope,
  leadScope,
  opportunityScope,
  proposalScope,
} from "../../services/scope.service.js";
import type { Actor } from "../../types/express.js";
import { AppError } from "../../utils/http.js";
import { calculateTotals, type DiscountInput } from "../../utils/money.js";
import { paginate, populateNamed, populateUser, searchFilter } from "../../utils/query.js";
import { Client } from "../clients/model.js";
import { Lead } from "../leads/model.js";
import { Opportunity } from "../opportunities/model.js";
import { autoAdvanceOpportunity } from "../opportunities/service.js";
import { getCompanySettings } from "../settings/service.js";
import { Proposal, ProposalRevision } from "./model.js";
import { assertProposalTransition, isEditable } from "./status.js";
import type {
  createProposalSchema,
  listProposalsSchema,
  updateProposalSchema,
} from "./validator.js";

const POPULATE = [
  populateNamed("client", "name companyName email"),
  populateNamed("lead", "fullName companyName email"),
  populateUser("createdBy"),
];

function priced<
  T extends {
    items: { quantity: number; unitPrice: number }[];
    discount?: DiscountInput;
    taxRateBp?: number;
  },
>(input: T) {
  const totals = calculateTotals(input.items, input.discount, input.taxRateBp ?? 0);
  return {
    ...input,
    items: input.items.map((item, index) => ({ ...item, amount: totals.lineAmounts[index] })),
    subtotal: totals.subtotal,
    discountAmount: totals.discountAmount,
    taxAmount: totals.taxAmount,
    total: totals.total,
  };
}

async function assertLinksVisible(
  actor: Actor,
  input: { client?: string | null; lead?: string | null; opportunity?: string | null },
) {
  if (input.client)
    assertFound(
      await Client.exists({ $and: [{ _id: input.client }, await clientScope(actor)] }),
      "Client",
    );
  if (input.lead)
    assertFound(await Lead.exists({ $and: [{ _id: input.lead }, leadScope(actor)] }), "Lead");
  if (input.opportunity)
    assertFound(
      await Opportunity.exists({ $and: [{ _id: input.opportunity }, opportunityScope(actor)] }),
      "Opportunity",
    );
}

export function listProposals(actor: Actor, query: z.infer<typeof listProposalsSchema>) {
  return paginate(
    Proposal,
    {
      $and: [
        proposalScope(actor),
        { archivedAt: null },
        searchFilter(["number", "title"], query.search),
        ...(query.status ? [{ status: query.status }] : []),
        ...(query.client ? [{ client: toObjectId(query.client) }] : []),
        ...(query.lead ? [{ lead: toObjectId(query.lead) }] : []),
      ],
    },
    {
      page: query.page,
      limit: query.limit,
      sort: { [query.sortBy ?? "createdAt"]: query.sortOrder === "asc" ? 1 : -1 },
      populate: POPULATE,
      select:
        "number title client lead status currency total validUntil sentAt createdBy createdAt revision",
    },
  );
}

const findScoped = async (actor: Actor, id: string, session?: ClientSession) =>
  assertFound(
    await Proposal.findOne({ $and: [{ _id: id, archivedAt: null }, proposalScope(actor)] }).session(
      session ?? null,
    ),
    "Proposal",
  );

export async function getProposal(actor: Actor, id: string) {
  const proposal = await findScoped(actor, id);
  await proposal.populate([
    ...POPULATE,
    populateNamed("opportunity", "title stage"),
    { path: "items.service", select: "name" },
  ]);
  return proposal;
}

export async function createProposal(actor: Actor, input: z.infer<typeof createProposalSchema>) {
  await assertLinksVisible(actor, input);
  const settings = await getCompanySettings();
  const opportunity =
    input.opportunity ??
    (input.lead
      ? (await Lead.findById(input.lead).select("opportunity").lean())?.opportunity?.toString()
      : null);
  const data = priced(input);
  return withTransaction(async (session) => {
    const [proposal] = await Proposal.create(
      [
        {
          terms: settings.documents?.proposal?.defaultTerms ?? "",
          paymentTerms: settings.documents?.invoice?.defaultPaymentTerms ?? "",
          ...data,
          opportunity,
          number: await nextDocumentNumber("proposal", session),
          createdBy: actor.id,
          updatedBy: actor.id,
        },
      ],
      { session },
    );
    if (!proposal) throw new Error("Proposal was not created");
    await logActivity(
      actor,
      {
        action: "proposal.created",
        description: `Proposal ${proposal.number} created`,
        entityType: "PROPOSAL",
        entityId: proposal._id,
        client: proposal.client,
        lead: proposal.lead,
      },
      session,
    );
    await audit(
      actor,
      {
        action: "proposal.create",
        entityType: "Proposal",
        entityId: proposal._id,
        summary: proposal.number,
      },
      session,
    );
    return proposal;
  });
}

/** Every edit snapshots the prior state so that earlier versions of a proposal stay viewable. */
export async function updateProposal(
  actor: Actor,
  id: string,
  input: z.infer<typeof updateProposalSchema>,
) {
  await assertLinksVisible(actor, input);
  return withTransaction(async (session) => {
    const proposal = await findScoped(actor, id, session);
    if (!isEditable(proposal.status))
      throw AppError.conflict("An accepted proposal cannot be edited. Duplicate it instead.");

    await ProposalRevision.create(
      [
        {
          proposal: proposal._id,
          revision: proposal.revision,
          snapshot: proposal.toObject(),
          changedBy: actor.id,
        },
      ],
      { session },
    );
    const merged = priced({
      items:
        input.items ??
        proposal.items.map((i) => ({
          service: i.service ? String(i.service) : null,
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
      discount: (input.discount ?? {
        type: proposal.discount?.type ?? "PERCENT",
        value: proposal.discount?.value ?? 0,
      }) as DiscountInput,
      taxRateBp: input.taxRateBp ?? proposal.taxRateBp,
    });
    proposal.set({ ...input, ...merged, updatedBy: actor.id });
    proposal.revision += 1;
    await proposal.save({ session });
    await audit(
      actor,
      {
        action: "proposal.update",
        entityType: "Proposal",
        entityId: proposal._id,
        summary: `${proposal.number} revision ${proposal.revision}`,
      },
      session,
    );
    return proposal;
  });
}

export async function listRevisions(actor: Actor, id: string) {
  await findScoped(actor, id);
  return ProposalRevision.find({ proposal: id })
    .sort({ revision: -1 })
    .limit(100)
    .populate(populateUser("changedBy"))
    .lean();
}

export async function duplicateProposal(actor: Actor, id: string) {
  const source = await findScoped(actor, id);
  const copy: Partial<ReturnType<typeof source.toObject>> & { title: string } = source.toObject();
  for (const field of [
    "_id",
    "number",
    "status",
    "revision",
    "sentAt",
    "viewedAt",
    "acceptedAt",
    "rejectedAt",
    "createdAt",
    "updatedAt",
    "__v",
  ] as const) {
    delete (copy as Record<string, unknown>)[field];
  }
  return withTransaction(async (session) => {
    const [proposal] = await Proposal.create(
      [
        {
          ...copy,
          title: `${copy.title} (copy)`,
          number: await nextDocumentNumber("proposal", session),
          status: "DRAFT",
          revision: 1,
          createdBy: actor.id,
          updatedBy: actor.id,
        },
      ],
      { session },
    );
    if (!proposal) throw new Error("Proposal was not created");
    await audit(
      actor,
      {
        action: "proposal.duplicate",
        entityType: "Proposal",
        entityId: proposal._id,
        summary: `${proposal.number} from ${source.number}`,
      },
      session,
    );
    return proposal;
  });
}

export async function setProposalStatus(
  actor: Actor,
  id: string,
  status: "SENT" | "VIEWED" | "ACCEPTED" | "REJECTED" | "EXPIRED",
  channel: "manual" | "email" = "manual",
) {
  return withTransaction(async (session) => {
    const current = await findScoped(actor, id, session);
    assertProposalTransition(current.status, status);
    const now = new Date();
    const stamp = {
      SENT: "sentAt",
      VIEWED: "viewedAt",
      ACCEPTED: "acceptedAt",
      REJECTED: "rejectedAt",
      EXPIRED: null,
    }[status];
    const proposal = await Proposal.findOneAndUpdate(
      { _id: current._id, status: current.status },
      { $set: { status, updatedBy: actor.id, ...(stamp ? { [stamp]: now } : {}) } },
      { returnDocument: "after", session },
    );
    if (!proposal)
      throw AppError.conflict("This proposal was changed by someone else. Refresh and try again.");

    const verb =
      status === "SENT"
        ? channel === "email"
          ? "emailed to the client"
          : "marked as sent"
        : status.toLowerCase();
    await logActivity(
      actor,
      {
        action: `proposal.${status.toLowerCase()}`,
        description: `Proposal ${proposal.number} ${verb}`,
        entityType: "PROPOSAL",
        entityId: proposal._id,
        client: proposal.client,
        lead: proposal.lead,
      },
      session,
    );
    await audit(
      actor,
      {
        action: "proposal.status",
        entityType: "Proposal",
        entityId: proposal._id,
        before: { status: current.status },
        after: { status, channel },
      },
      session,
    );

    if (status === "SENT")
      await autoAdvanceOpportunity(actor, proposal.opportunity, "PROPOSAL_SENT", session);
    if (status === "ACCEPTED") {
      await autoAdvanceOpportunity(actor, proposal.opportunity, "WON", session);
      const owner = proposal.opportunity
        ? await Opportunity.findById(proposal.opportunity)
            .select("assignedTo")
            .session(session)
            .lean()
        : null;
      await notifyMany(
        [proposal.createdBy, owner?.assignedTo].filter((u) => u && String(u) !== actor.id),
        {
          type: "PROPOSAL_ACCEPTED",
          title: "Proposal accepted",
          message: `${proposal.number}: ${proposal.title}`,
          link: `/proposals/${proposal._id}`,
          entityType: "PROPOSAL",
          entityId: proposal._id,
        },
        session,
      );
    }
    return proposal;
  });
}

export async function archiveProposal(actor: Actor, id: string) {
  const proposal = await findScoped(actor, id);
  if (proposal.status === "ACCEPTED")
    throw AppError.conflict("Accepted proposals are retained and cannot be deleted");
  proposal.archivedAt = new Date();
  await proposal.save();
  await audit(actor, {
    action: "proposal.archive",
    entityType: "Proposal",
    entityId: proposal._id,
    summary: proposal.number,
  });
}

export async function renderProposalPdf(actor: Actor, id: string) {
  const proposal = await findScoped(actor, id);
  const [client, lead, settings] = await Promise.all([
    proposal.client ? Client.findById(proposal.client).lean() : null,
    proposal.lead ? Lead.findById(proposal.lead).lean() : null,
    getCompanySettings(),
  ]);
  const recipient = client
    ? {
        name: client.name,
        company: client.companyName,
        email: client.email,
        country: client.country,
      }
    : {
        name: lead?.fullName ?? "",
        company: lead?.companyName ?? "",
        email: lead?.email ?? "",
        country: lead?.country ?? "",
      };
  return {
    number: proposal.number,
    pdf: await proposalPdf(proposal.toObject(), recipient, settings),
    recipient,
  };
}

export async function emailProposal(actor: Actor, id: string, to?: string) {
  const { pdf, number, recipient } = await renderProposalPdf(actor, id);
  const address = to || recipient.email;
  if (!address) throw AppError.badRequest("No recipient email is on file. Enter a recipient.");
  const current = await findScoped(actor, id);
  assertProposalTransition(current.status, "SENT");
  const result = await sendEmail({
    to: address,
    subject: `Proposal ${number} from SAS3D`,
    html: `<p>Please find proposal ${number} attached.</p>`,
    attachments: [{ filename: `${number}.pdf`, content: pdf }],
  });
  // Marked as sent only after the provider confirms it accepted the message.
  if (!result.sent) throw new AppError(502, `The proposal was not sent: ${result.reason}`);
  await setProposalStatus(actor, id, "SENT", "email");
  return { sentTo: address, providerId: result.providerId };
}
