import { SAMPLE_LEADS } from "./demo-names.js";
import { logger } from "../config/logger.js";
import { isProduction } from "../config/env.js";
import { getAuth, provisionUser } from "../config/auth.js";
import { createClient } from "../modules/clients/service.js";
import { Client } from "../modules/clients/model.js";
import { createInvoice, issueInvoice } from "../modules/invoices/service.js";
import { createLead } from "../modules/leads/service.js";
import { moveOpportunity } from "../modules/opportunities/service.js";
import { recordPayment } from "../modules/payments/service.js";
import { createProject } from "../modules/projects/service.js";
import { Milestone } from "../modules/projects/model.js";
import { createTask } from "../modules/tasks/service.js";
import { User } from "../modules/users/model.js";
import { Lead } from "../modules/leads/model.js";
import type { Actor } from "../types/express.js";
import { connectDatabase, disconnectDatabase } from "./connection.js";
import { initDatabase } from "./models.js";
import { seedBase } from "./seed.js";

/**
 * Optional sample data for trying the app locally. Every record is prefixed "[DEMO]" with reserved
 * example.com addresses, so it can never be mistaken for a real SAS3D client or result.
 */
async function main() {
  if (isProduction) throw new Error("The demo seed does not run with NODE_ENV=production");
  await connectDatabase();
  await initDatabase();
  await seedBase();
  await getAuth().$context;

  if (await Client.exists({ name: /^\[DEMO\]/ })) {
    logger.info("Demo data already exists");
    return disconnectDatabase();
  }

  const password = process.env.DEMO_USER_PASSWORD;
  if (!password || password.length < 10)
    throw new Error("Set DEMO_USER_PASSWORD (10+ characters) to create demo users");
  for (const role of ["SALES", "PROJECT_MANAGER", "DEVELOPER", "FINANCE"]) {
    const email = `${role.toLowerCase().replace("_", "-")}@demo.example.com`;
    if (!(await User.exists({ email })))
      await provisionUser({
        name: `[DEMO] ${role}`,
        email,
        password,
        role,
        extra: { designation: "Demo account" },
      });
  }

  const owner = await User.findOne({ role: "SUPER_ADMIN" }).lean();
  if (!owner) throw new Error("Seed an administrator first");
  const actor: Actor = {
    id: String(owner._id),
    name: owner.name,
    email: owner.email,
    role: "SUPER_ADMIN",
    ip: "",
  };

  const stages = [
    "NEW",
    "CONTACTED",
    "INTERESTED",
    "MEETING_SCHEDULED",
    "PROPOSAL_SENT",
    "NEGOTIATION",
  ] as const;
  for (const [index, person] of SAMPLE_LEADS.entries()) {
    await createLead(actor, {
      fullName: `[DEMO] ${person.name}`,
      companyName: `[DEMO] ${person.company}`,
      email: `lead${index}@demo.example.com`,
      country: person.country,
      timezone: person.timezone,
      source: person.source,
      estimatedBudget: person.budget,
      budgetCurrency: person.currency,
      nextFollowUpAt: new Date(Date.now() + (index - 2) * 86_400_000),
    });
    const lead = await Lead.findOne({ email: `lead${index}@demo.example.com` }).lean();
    const stage = stages[index % stages.length];
    if (lead?.opportunity && stage && stage !== "NEW")
      await moveOpportunity(actor, String(lead.opportunity), { to: stage });
  }

  const client = await createClient(actor, {
    name: "[DEMO] Example Client",
    companyName: "[DEMO] Example Ltd",
    email: "client@demo.example.com",
    country: "United Kingdom",
    timezone: "Europe/London",
    billingAddress: { line1: "1 Example Street", city: "London", country: "United Kingdom" },
  });
  const project = await createProject(actor, {
    name: "[DEMO] Website rebuild",
    client: String(client._id),
    status: "IN_PROGRESS",
    budget: 800000,
    currency: "GBP",
    expectedDeliveryDate: new Date(Date.now() + 30 * 86_400_000),
  });
  await Milestone.create({
    project: project._id,
    title: "[DEMO] Discovery",
    status: "COMPLETED",
    completedAt: new Date(),
    createdBy: actor.id,
  });
  await Milestone.create({
    project: project._id,
    title: "[DEMO] Launch",
    status: "PENDING",
    dueDate: new Date(Date.now() + 2 * 86_400_000),
    createdBy: actor.id,
  });
  await createTask(actor, {
    title: "[DEMO] Review designs",
    project: String(project._id),
    dueAt: new Date(Date.now() + 86_400_000),
    hasDueTime: true,
  });

  const invoice = await createInvoice(actor, {
    client: String(client._id),
    project: String(project._id),
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 14 * 86_400_000),
    currency: "GBP",
    items: [{ description: "[DEMO] Deposit", quantity: 1, unitPrice: 400000 }],
    taxRateBp: 2000,
  });
  await issueInvoice(actor, String(invoice._id));
  await recordPayment(actor, {
    invoice: String(invoice._id),
    amount: 200000,
    currency: "GBP",
    paymentDate: new Date(),
    method: "BANK_TRANSFER",
    transactionReference: "DEMO-1",
  });

  logger.info("Demo data created");
  await disconnectDatabase();
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, "Demo seed failed");
  process.exit(1);
});
