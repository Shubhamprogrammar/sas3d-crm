import type { ClientSession } from "mongoose";
import { parse as parseCsv } from "csv-parse/sync";
import { stringify as stringifyCsv } from "csv-stringify/sync";
import { LEAD_SOURCES, PRIORITIES } from "../../config/constants.js";
import { toObjectId, withTransaction } from "../../database/connection.js";
import { logActivity } from "../../services/activity.service.js";
import { audit } from "../../services/audit.service.js";
import { notify } from "../../services/notification.service.js";
import { assertFound, leadScope } from "../../services/scope.service.js";
import type { Actor } from "../../types/express.js";
import { csvSafe } from "../../utils/csv.js";
import { AppError } from "../../utils/http.js";
import { minorToDecimal } from "../../utils/money.js";
import { paginate, populateNamed, populateUser, searchFilter } from "../../utils/query.js";
import { findOrCreateClientFromLead } from "../clients/service.js";
import { Opportunity, StageHistory } from "../opportunities/model.js";
import { Lead } from "./model.js";
import {
  createLeadSchema,
  type CreateLeadInput,
  type ListLeadsQuery,
  type UpdateLeadInput,
} from "./validator.js";

const digitsOnly = (phone?: string) => (phone ?? "").replace(/\D/g, "");

const SEARCH_FIELDS = ["fullName", "companyName", "email", "phone", "city", "country"];
const LIST_POPULATE = [
  populateUser("assignedTo"),
  populateNamed("interestedServices", "name category"),
];

function buildFilter(actor: Actor, query: ListLeadsQuery) {
  return {
    $and: [
      leadScope(actor),
      searchFilter(SEARCH_FIELDS, query.search),
      query.archived === "true" ? { archivedAt: { $ne: null } } : { archivedAt: null },
      ...(query.status ? [{ status: query.status }] : []),
      ...(query.source ? [{ source: query.source }] : []),
      ...(query.priority ? [{ priority: query.priority }] : []),
      ...(query.country ? [{ country: query.country }] : []),
      ...(query.service ? [{ interestedServices: toObjectId(query.service) }] : []),
      ...(query.assignedTo ? [{ assignedTo: toObjectId(query.assignedTo) }] : []),
    ],
  };
}

export function listLeads(actor: Actor, query: ListLeadsQuery) {
  return paginate(Lead, buildFilter(actor, query), {
    page: query.page,
    limit: query.limit,
    sort: { [query.sortBy ?? "createdAt"]: query.sortOrder === "asc" ? 1 : -1 },
    populate: LIST_POPULATE,
  });
}

export async function getLead(actor: Actor, id: string) {
  const lead = await Lead.findOne({ _id: id, ...leadScope(actor) })
    .populate(LIST_POPULATE)
    .populate("opportunity", "stage value currency project client lostReason")
    .populate("convertedClient", "name companyName")
    .lean();
  return assertFound(lead, "Lead");
}

/**
 * Duplicate detection crosses assignment scope on purpose: two salespeople must not work the same
 * lead unknowingly. It therefore returns only the summary needed to recognise the record.
 */
export async function findDuplicates(input: {
  email?: string;
  phone?: string;
  excludeId?: string;
}) {
  const conditions: Record<string, string>[] = [];
  if (input.email) conditions.push({ email: input.email.toLowerCase() });
  const digits = digitsOnly(input.phone);
  if (digits.length >= 7) conditions.push({ phoneDigits: digits });
  if (!conditions.length) return [];
  return Lead.find({
    $or: conditions,
    archivedAt: null,
    ...(input.excludeId ? { _id: { $ne: input.excludeId } } : {}),
  })
    .select("fullName companyName email phone status")
    .limit(10)
    .lean();
}

async function createLeadInTx(actor: Actor, input: CreateLeadInput, session: ClientSession) {
  const data = { ...input };
  delete data.allowDuplicate;
  const assignedTo = data.assignedTo === undefined ? actor.id : data.assignedTo;
  const [lead] = await Lead.create(
    [
      {
        ...data,
        assignedTo,
        phoneDigits: digitsOnly(data.phone),
        createdBy: actor.id,
        updatedBy: actor.id,
      },
    ],
    { session },
  );
  if (!lead) throw new Error("Lead was not created");

  const [opportunity] = await Opportunity.create(
    [
      {
        title: lead.companyName || lead.fullName,
        lead: lead._id,
        contactName: lead.fullName,
        companyName: lead.companyName,
        country: lead.country,
        value: lead.estimatedBudget,
        currency: lead.budgetCurrency,
        service: lead.interestedServices[0] ?? null,
        assignedTo,
        priority: lead.priority,
        nextFollowUpAt: lead.nextFollowUpAt,
        createdBy: actor.id,
      },
    ],
    { session },
  );
  if (!opportunity) throw new Error("Opportunity was not created");
  lead.opportunity = opportunity._id;
  await lead.save({ session });

  await StageHistory.create(
    [{ opportunity: opportunity._id, from: null, to: "NEW", changedBy: actor.id }],
    { session },
  );
  await logActivity(
    actor,
    {
      action: "lead.created",
      description: `Lead ${lead.fullName} created`,
      entityType: "LEAD",
      entityId: lead._id,
      lead: lead._id,
    },
    session,
  );
  await audit(
    actor,
    { action: "lead.create", entityType: "Lead", entityId: lead._id, summary: lead.fullName },
    session,
  );
  if (assignedTo && String(assignedTo) !== actor.id) {
    await notify(
      {
        recipient: assignedTo,
        type: "LEAD_ASSIGNED",
        title: "New lead assigned to you",
        message: lead.companyName ? `${lead.fullName} (${lead.companyName})` : lead.fullName,
        link: `/leads/${lead._id}`,
        entityType: "LEAD",
        entityId: lead._id,
      },
      session,
    );
  }
  return lead;
}

export async function createLead(actor: Actor, input: CreateLeadInput) {
  if (!input.allowDuplicate) {
    const duplicates = await findDuplicates({ email: input.email, phone: input.phone });
    if (duplicates.length) {
      throw AppError.conflict(
        "A lead with the same email or phone already exists",
        duplicates.map((d) => ({
          code: "DUPLICATE_LEAD",
          id: d._id,
          fullName: d.fullName,
          companyName: d.companyName,
          email: d.email,
          phone: d.phone,
          status: d.status,
        })),
      );
    }
  }
  return withTransaction((session) => createLeadInTx(actor, input, session));
}

export async function updateLead(actor: Actor, id: string, input: UpdateLeadInput) {
  return withTransaction(async (session) => {
    const lead = assertFound(
      await Lead.findOne({ _id: id, ...leadScope(actor) }).session(session),
      "Lead",
    );
    const before = lead.toObject();
    const previousAssignee = lead.assignedTo ? String(lead.assignedTo) : null;

    lead.set({ ...input, updatedBy: actor.id });
    if (input.phone !== undefined) lead.phoneDigits = digitsOnly(input.phone);
    await lead.save({ session });

    if (lead.opportunity) {
      const opportunity = await Opportunity.findById(lead.opportunity).session(session);
      if (opportunity) {
        opportunity.set({
          contactName: lead.fullName,
          companyName: lead.companyName,
          country: lead.country,
          assignedTo: lead.assignedTo,
          priority: lead.priority,
          nextFollowUpAt: lead.nextFollowUpAt,
          value: lead.estimatedBudget,
          currency: lead.budgetCurrency,
          service: lead.interestedServices[0] ?? opportunity.service,
          updatedBy: actor.id,
        });
        await opportunity.save({ session });
      }
    }

    const newAssignee = lead.assignedTo ? String(lead.assignedTo) : null;
    if (newAssignee !== previousAssignee) {
      await logActivity(
        actor,
        {
          action: "lead.assigned",
          description: `Lead ${lead.fullName} reassigned`,
          entityType: "LEAD",
          entityId: lead._id,
          lead: lead._id,
        },
        session,
      );
      if (newAssignee && newAssignee !== actor.id) {
        await notify(
          {
            recipient: newAssignee,
            type: "LEAD_ASSIGNED",
            title: "Lead assigned to you",
            message: lead.fullName,
            link: `/leads/${lead._id}`,
            entityType: "LEAD",
            entityId: lead._id,
          },
          session,
        );
      }
    }
    await audit(
      actor,
      {
        action: "lead.update",
        entityType: "Lead",
        entityId: lead._id,
        summary: lead.fullName,
        before: { assignedTo: before.assignedTo, priority: before.priority },
      },
      session,
    );
    return lead;
  });
}

async function setArchived(actor: Actor, id: string, archived: boolean) {
  return withTransaction(async (session) => {
    const lead = assertFound(
      await Lead.findOne({ _id: id, ...leadScope(actor) }).session(session),
      "Lead",
    );
    const archivedAt = archived ? new Date() : null;
    lead.archivedAt = archivedAt;
    lead.updatedBy = toObjectId(actor.id);
    await lead.save({ session });
    await Opportunity.updateOne({ lead: lead._id }, { $set: { archivedAt } }, { session });
    await audit(
      actor,
      {
        action: archived ? "lead.archive" : "lead.restore",
        entityType: "Lead",
        entityId: lead._id,
        summary: lead.fullName,
      },
      session,
    );
    return lead;
  });
}
export const archiveLead = (actor: Actor, id: string) => setArchived(actor, id, true);
export const restoreLead = (actor: Actor, id: string) => setArchived(actor, id, false);

/** Safe to repeat: a lead that is already converted returns its existing client. */
export async function convertLead(actor: Actor, id: string) {
  return withTransaction(async (session) => {
    const lead = assertFound(
      await Lead.findOne({ _id: id, ...leadScope(actor) }).session(session),
      "Lead",
    );
    const alreadyConverted = Boolean(lead.convertedClient);
    const client = await findOrCreateClientFromLead(actor, lead, session);
    return { client, alreadyConverted };
  });
}

const HEADER_ALIASES: Record<string, keyof CreateLeadInput> = {
  "full name": "fullName",
  fullname: "fullName",
  name: "fullName",
  company: "companyName",
  "company name": "companyName",
  companyname: "companyName",
  email: "email",
  phone: "phone",
  whatsapp: "whatsapp",
  "whatsapp number": "whatsapp",
  country: "country",
  state: "state",
  city: "city",
  timezone: "timezone",
  website: "website",
  linkedin: "linkedinUrl",
  "linkedin url": "linkedinUrl",
  linkedinurl: "linkedinUrl",
  source: "source",
  priority: "priority",
  description: "description",
  requirements: "requirements",
};

const upperSnake = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");

export const MAX_IMPORT_ROWS = 5000;

/** Each row is validated and saved on its own, so one bad row never discards the whole import. */
export async function importLeads(actor: Actor, csv: Buffer) {
  let rows: Record<string, string>[];
  try {
    rows = parseCsv(csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
      relax_column_count: true,
    });
  } catch {
    throw AppError.badRequest("The file could not be read as CSV");
  }
  if (rows.length > MAX_IMPORT_ROWS)
    throw AppError.badRequest(`A CSV import is limited to ${MAX_IMPORT_ROWS} rows`);

  const result = {
    created: 0,
    duplicates: 0,
    failed: 0,
    errors: [] as { row: number; message: string }[],
  };
  for (const [index, row] of rows.entries()) {
    const mapped: Record<string, unknown> = {};
    for (const [header, value] of Object.entries(row)) {
      const field = HEADER_ALIASES[header.trim().toLowerCase()];
      if (field && value) mapped[field] = value;
    }
    if (typeof mapped.source === "string") {
      const source = upperSnake(mapped.source);
      mapped.source = (LEAD_SOURCES as readonly string[]).includes(source) ? source : "OTHER";
    }
    if (typeof mapped.priority === "string") {
      const priority = upperSnake(mapped.priority);
      mapped.priority = (PRIORITIES as readonly string[]).includes(priority) ? priority : "MEDIUM";
    }

    const parsed = createLeadSchema.safeParse(mapped);
    if (!parsed.success) {
      result.failed += 1;
      const issue = parsed.error.issues[0];
      result.errors.push({
        row: index + 2,
        message: `${issue?.path.join(".")}: ${issue?.message}`,
      });
      continue;
    }
    const duplicates = await findDuplicates({ email: parsed.data.email, phone: parsed.data.phone });
    if (duplicates.length) {
      result.duplicates += 1;
      continue;
    }
    await withTransaction((session) => createLeadInTx(actor, parsed.data, session));
    result.created += 1;
  }
  await audit(actor, {
    action: "lead.import",
    entityType: "Lead",
    summary: `${result.created} created, ${result.duplicates} duplicates, ${result.failed} failed`,
  });
  return result;
}

export async function exportLeads(actor: Actor, query: ListLeadsQuery) {
  const leads = await Lead.find(buildFilter(actor, query))
    .sort({ createdAt: -1 })
    .limit(10000)
    .populate(LIST_POPULATE)
    .lean();
  await audit(actor, {
    action: "lead.export",
    entityType: "Lead",
    summary: `${leads.length} leads`,
  });
  type WithAssignee = {
    assignedTo?: { name?: string } | null;
    interestedServices?: { name?: string }[];
  };
  return stringifyCsv(
    leads.map((lead) => {
      const populated = lead as unknown as WithAssignee;
      return [
        lead.fullName,
        lead.companyName,
        lead.email,
        lead.phone,
        lead.whatsapp,
        lead.country,
        lead.state,
        lead.city,
        lead.timezone,
        lead.website,
        lead.linkedinUrl,
        lead.source,
        lead.priority,
        lead.status,
        minorToDecimal(lead.estimatedBudget ?? 0),
        lead.budgetCurrency,
        populated.assignedTo?.name ?? "",
        (populated.interestedServices ?? []).map((s) => s.name).join("; "),
        lead.createdAt.toISOString(),
        lead.nextFollowUpAt?.toISOString() ?? "",
      ].map(csvSafe);
    }),
    {
      header: true,
      columns: [
        "Full Name",
        "Company",
        "Email",
        "Phone",
        "WhatsApp",
        "Country",
        "State",
        "City",
        "Timezone",
        "Website",
        "LinkedIn",
        "Source",
        "Priority",
        "Status",
        "Estimated Budget",
        "Currency",
        "Assigned To",
        "Services",
        "Created At",
        "Next Follow-up",
      ],
    },
  );
}
