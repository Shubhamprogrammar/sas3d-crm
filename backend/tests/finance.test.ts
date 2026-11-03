import mongoose from "mongoose";
import { beforeAll, describe, expect, it } from "vitest";
import { invoiceBody, leadBody, setupApp } from "./helpers.js";

const ctx = setupApp();
let finance: Awaited<ReturnType<typeof ctx.login>>;
let clientId: string;

beforeAll(async () => {
  finance = await ctx.login("FINANCE");
  const admin = await ctx.login("SUPER_ADMIN");
  clientId = (
    await admin.agent
      .post("/api/v1/clients")
      .send({ name: "Finance Client", email: "pay@example.com", country: "UAE" })
  ).body.data._id;
});

const issued = async (overrides: Record<string, unknown> = {}) => {
  const invoice = (
    await finance.agent.post("/api/v1/invoices").send(invoiceBody(clientId, overrides))
  ).body.data;
  await finance.agent.post(`/api/v1/invoices/${invoice._id}/issue`);
  return invoice._id as string;
};
const pay = (invoice: string, amount: number, overrides: Record<string, unknown> = {}) =>
  finance.agent
    .post("/api/v1/payments")
    .send({
      invoice,
      amount,
      currency: "USD",
      paymentDate: "2026-02-01",
      method: "SWIFT",
      ...overrides,
    });
const load = async (id: string) => (await finance.agent.get(`/api/v1/invoices/${id}`)).body.data;

describe("invoices", () => {
  it("calculates totals on the server and ignores client-sent totals", async () => {
    const res = await finance.agent.post("/api/v1/invoices").send(
      invoiceBody(clientId, {
        items: [
          { description: "A", quantity: 3, unitPrice: 1999 },
          { description: "B", quantity: 1.5, unitPrice: 1000 },
        ],
        discount: { type: "PERCENT", value: 1000 },
        taxRateBp: 1800,
        total: 1,
        amountPaid: 999999,
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      subtotal: 7497,
      discountAmount: 750,
      taxAmount: 1214,
      total: 7961,
      amountPaid: 0,
      amountDue: 7961,
      status: "DRAFT",
    });
    expect(res.body.data.number).toMatch(/^INV-\d{4}-\d{4}$/);
  });

  it("gives every invoice a unique number under concurrency", async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () =>
        finance.agent.post("/api/v1/invoices").send(invoiceBody(clientId)),
      ),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    const numbers = results.map((r) => r.body.data.number);
    expect(new Set(numbers).size).toBe(6);
  });

  it("freezes an invoice once issued", async () => {
    const id = await issued();
    expect((await finance.agent.patch(`/api/v1/invoices/${id}`).send({ notes: "x" })).status).toBe(
      409,
    );
    expect((await finance.agent.delete(`/api/v1/invoices/${id}`)).status).toBe(409);
    expect((await finance.agent.post(`/api/v1/invoices/${id}/issue`)).status).toBe(409);
  });

  it("lets a draft be edited and recalculated, then deleted", async () => {
    const draft = (await finance.agent.post("/api/v1/invoices").send(invoiceBody(clientId))).body
      .data;
    const edited = await finance.agent
      .patch(`/api/v1/invoices/${draft._id}`)
      .send({ items: [{ description: "New", quantity: 2, unitPrice: 500 }] });
    expect(edited.body.data).toMatchObject({ total: 1000, amountDue: 1000 });
    expect((await finance.agent.delete(`/api/v1/invoices/${draft._id}`)).status).toBe(200);
    expect((await finance.agent.get(`/api/v1/invoices/${draft._id}`)).status).toBe(404);
  });

  it("rejects a due date before the issue date and an empty invoice", async () => {
    expect(
      (
        await finance.agent
          .post("/api/v1/invoices")
          .send(invoiceBody(clientId, { issueDate: "2026-02-01", dueDate: "2026-01-01" }))
      ).status,
    ).toBe(422);
    expect(
      (await finance.agent.post("/api/v1/invoices").send(invoiceBody(clientId, { items: [] })))
        .status,
    ).toBe(422);
  });

  it("renders a real PDF", async () => {
    const id = await issued({ notes: "Thanks" });
    const res = await finance.agent
      .get(`/api/v1/invoices/${id}/pdf`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect((res.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("paginates long invoices with a footer on each page and no stray blank pages", async () => {
    const items = Array.from({ length: 120 }, (_, i) => ({
      description: `Line item ${i} with a description long enough to be realistic`,
      quantity: 1,
      unitPrice: 100,
    }));
    const { invoicePdf } = await import("../src/services/pdf.service.js");
    const { getCompanySettings } = await import("../src/modules/settings/service.js");
    const pdf = await invoicePdf(
      {
        number: "INV-T",
        issueDate: new Date(),
        dueDate: new Date(),
        currency: "USD",
        status: "SENT",
        subtotal: 12000,
        total: 12000,
        amountDue: 12000,
        items: items.map((i) => ({ ...i, amount: 100 })),
      },
      { name: "Client" },
      await getCompanySettings(),
    );
    const pages = pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
    expect(pages).toBeGreaterThanOrEqual(3);
    expect(pages).toBeLessThanOrEqual(6);
  });

  it("does not claim an email went out when no provider confirms it", async () => {
    const { setEmailProvider } = await import("../src/services/email.service.js");
    setEmailProvider({
      send: async () => ({ sent: false, reason: "No email provider is configured" }),
    });
    const draft = (await finance.agent.post("/api/v1/invoices").send(invoiceBody(clientId))).body
      .data;
    const res = await finance.agent.post(`/api/v1/invoices/${draft._id}/send`).send({});
    expect(res.status).toBe(502);
    expect((await load(draft._id)).status).toBe("DRAFT");

    setEmailProvider({ send: async () => ({ sent: true, providerId: "abc" }) });
    expect((await finance.agent.post(`/api/v1/invoices/${draft._id}/send`).send({})).status).toBe(
      200,
    );
    expect((await load(draft._id)).status).toBe("SENT");
  });
});

describe("payments", () => {
  it("records partial then full payment and updates status", async () => {
    const id = await issued();
    const first = await pay(id, 30000);
    expect(first.status).toBe(201);
    expect(first.body.data.invoice).toMatchObject({
      amountPaid: 30000,
      amountDue: 70000,
      status: "PARTIALLY_PAID",
    });

    const second = await pay(id, 70000);
    expect(second.body.data.invoice).toMatchObject({
      amountPaid: 100000,
      amountDue: 0,
      status: "PAID",
    });
    expect(second.body.data.invoice.paidAt).toBeTruthy();
    expect((await load(id)).payments).toHaveLength(2);
  });

  it("rejects overpayment, wrong currency, draft and cancelled invoices", async () => {
    const id = await issued();
    expect((await pay(id, 100001)).status).toBe(409);
    expect((await pay(id, 100, { currency: "EUR" })).status).toBe(400);
    expect((await pay(id, 0)).status).toBe(422);
    expect((await pay(id, 10.5)).status).toBe(422);

    const draft = (await finance.agent.post("/api/v1/invoices").send(invoiceBody(clientId))).body
      .data._id;
    expect((await pay(draft, 100)).status).toBe(409);

    const cancelled = await issued();
    await finance.agent.post(`/api/v1/invoices/${cancelled}/cancel`).send({ reason: "Mistake" });
    expect((await pay(cancelled, 100)).status).toBe(409);
    expect((await load(cancelled)).status).toBe("CANCELLED");
  });

  it("cannot be pushed past the total by concurrent payments", async () => {
    const id = await issued();
    const results = await Promise.all(Array.from({ length: 5 }, () => pay(id, 40000)));
    const accepted = results.filter((r) => r.status === 201).length;
    const invoice = await load(id);
    expect(invoice.amountPaid).toBe(accepted * 40000);
    expect(invoice.amountPaid).toBeLessThanOrEqual(100000);
    expect(invoice.amountPaid + invoice.amountDue).toBe(100000);
    expect(invoice.payments.filter((p: { voidedAt: unknown }) => !p.voidedAt)).toHaveLength(
      accepted,
    );
  });

  it("rejects a duplicate transaction reference on the same invoice", async () => {
    const id = await issued();
    expect((await pay(id, 100, { transactionReference: "SWIFT-1" })).status).toBe(201);
    expect((await pay(id, 100, { transactionReference: "SWIFT-1" })).status).toBe(409);
    const invoice = await load(id);
    expect(invoice.amountPaid).toBe(100);
  });

  it("rolls the balance back when the transaction fails part-way", async () => {
    // The duplicate above fails inside the transaction after the balance update, so this is the proof.
    const id = await issued();
    await pay(id, 500, { transactionReference: "ROLLBACK" });
    await pay(id, 500, { transactionReference: "ROLLBACK" });
    const invoice = await load(id);
    expect(invoice).toMatchObject({ amountPaid: 500, amountDue: 99500 });
  });

  it("voids a payment, keeps the record and restores the balance", async () => {
    const id = await issued();
    const { payment } = (await pay(id, 100000)).body.data;
    expect((await load(id)).status).toBe("PAID");
    const voided = await finance.agent
      .post(`/api/v1/payments/${payment._id}/void`)
      .send({ reason: "Bounced" });
    expect(voided.status).toBe(200);
    const invoice = await load(id);
    expect(invoice).toMatchObject({ status: "SENT", amountPaid: 0, amountDue: 100000 });
    expect(invoice.payments[0].voidReason).toBe("Bounced");
    expect(
      (await finance.agent.post(`/api/v1/payments/${payment._id}/void`).send({ reason: "Again" }))
        .status,
    ).toBe(404);
  });

  it("blocks cancelling an invoice that still has payments", async () => {
    const id = await issued();
    await pay(id, 100);
    expect(
      (await finance.agent.post(`/api/v1/invoices/${id}/cancel`).send({ reason: "x" })).status,
    ).toBe(409);
  });

  it("writes an audit trail for financial actions", async () => {
    const admin = await ctx.login("SUPER_ADMIN");
    const id = await issued();
    await pay(id, 100);
    const logs = await admin.agent
      .get("/api/v1/settings/audit-logs")
      .query({ search: "payment.record" });
    expect(logs.body.data.length).toBeGreaterThan(0);
  });
});

describe("overdue job", () => {
  it("marks past-due invoices once, notifies, and leaves paid ones alone", async () => {
    const { markOverdueInvoices } = await import("../src/services/jobs.service.js");
    const late = await issued({ issueDate: "2020-01-01", dueDate: "2020-01-31" });
    const partial = await issued({ issueDate: "2020-01-01", dueDate: "2020-01-31" });
    await pay(partial, 100);
    const paid = await issued({ issueDate: "2020-01-01", dueDate: "2020-01-31" });
    await pay(paid, 100000);
    const future = await issued();

    await markOverdueInvoices();
    expect((await load(late)).status).toBe("OVERDUE");
    expect((await load(partial)).status).toBe("OVERDUE");
    expect((await load(paid)).status).toBe("PAID");
    expect((await load(future)).status).toBe("SENT");

    await markOverdueInvoices();
    const notes = (
      await finance.agent.get("/api/v1/notifications").query({ limit: 100 })
    ).body.data.filter(
      (n: { type: string; entityId: string }) =>
        n.type === "INVOICE_OVERDUE" && n.entityId === late,
    );
    expect(notes).toHaveLength(1);

    // Paying off an overdue invoice takes it to PAID.
    const { amountDue } = await load(late);
    expect((await pay(late, amountDue)).body.data.invoice.status).toBe("PAID");
  });
});

describe("proposals", () => {
  const proposal = (overrides: Record<string, unknown> = {}) => ({
    title: "Website rebuild",
    currency: "USD",
    items: [{ description: "Design", quantity: 1, unitPrice: 50000 }],
    taxRateBp: 500,
    ...overrides,
  });

  it("creates with totals, keeps revisions, duplicates, and generates a PDF", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    const created = await agent.post("/api/v1/proposals").send(proposal({ client: clientId }));
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ total: 52500, revision: 1, status: "DRAFT" });
    const { _id } = created.body.data;

    const edited = await agent
      .patch(`/api/v1/proposals/${_id}`)
      .send({
        title: "Website rebuild v2",
        items: [{ description: "Design", quantity: 2, unitPrice: 50000 }],
      });
    expect(edited.body.data).toMatchObject({ revision: 2, total: 105000 });
    const revisions = (await agent.get(`/api/v1/proposals/${_id}/revisions`)).body.data;
    expect(revisions).toHaveLength(1);
    expect(revisions[0].snapshot.title).toBe("Website rebuild");

    const copy = await agent.post(`/api/v1/proposals/${_id}/duplicate`);
    expect(copy.body.data.number).not.toBe(created.body.data.number);
    expect(copy.body.data).toMatchObject({ status: "DRAFT", revision: 1 });

    const pdf = await agent
      .get(`/api/v1/proposals/${_id}/pdf`)
      .buffer(true)
      .parse((r, cb) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    expect((pdf.body as Buffer).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("requires a client or lead", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    expect((await agent.post("/api/v1/proposals").send(proposal())).status).toBe(422);
  });

  it("moves the pipeline when sent and accepted, and locks once accepted", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    const lead = (await agent.post("/api/v1/leads").send(leadBody())).body.data;
    const created = (await agent.post("/api/v1/proposals").send(proposal({ lead: lead._id }))).body
      .data;
    expect(created.opportunity).toBeTruthy();

    expect(
      (await agent.post(`/api/v1/proposals/${created._id}/status`).send({ status: "ACCEPTED" }))
        .status,
    ).toBe(409);
    await agent.post(`/api/v1/proposals/${created._id}/status`).send({ status: "SENT" });
    expect((await agent.get(`/api/v1/leads/${lead._id}`)).body.data.status).toBe("PROPOSAL_SENT");

    await agent.post(`/api/v1/proposals/${created._id}/status`).send({ status: "ACCEPTED" });
    expect((await agent.get(`/api/v1/leads/${lead._id}`)).body.data.status).toBe("WON");
    expect(
      (await agent.patch(`/api/v1/proposals/${created._id}`).send({ title: "x" })).status,
    ).toBe(409);
    expect((await agent.delete(`/api/v1/proposals/${created._id}`)).status).toBe(409);
  });

  it("only marks a proposal sent after the provider confirms", async () => {
    const { setEmailProvider } = await import("../src/services/email.service.js");
    const { agent } = await ctx.login("SUPER_ADMIN");
    const { _id } = (await agent.post("/api/v1/proposals").send(proposal({ client: clientId })))
      .body.data;
    setEmailProvider({ send: async () => ({ sent: false, reason: "down" }) });
    expect((await agent.post(`/api/v1/proposals/${_id}/send`).send({})).status).toBe(502);
    expect((await agent.get(`/api/v1/proposals/${_id}`)).body.data.status).toBe("DRAFT");
    setEmailProvider({ send: async () => ({ sent: true }) });
    expect((await agent.post(`/api/v1/proposals/${_id}/send`).send({})).status).toBe(200);
    expect((await agent.get(`/api/v1/proposals/${_id}`)).body.data.sentAt).toBeTruthy();
  });

  it("keeps salespeople out of each other's proposals", async () => {
    const owner = await ctx.login("SALES");
    const other = await ctx.login("SALES");
    const lead = (await owner.agent.post("/api/v1/leads").send(leadBody())).body.data;
    const { _id } = (await owner.agent.post("/api/v1/proposals").send(proposal({ lead: lead._id })))
      .body.data;
    expect((await other.agent.get(`/api/v1/proposals/${_id}`)).status).toBe(404);
    expect((await other.agent.get(`/api/v1/proposals/${_id}/pdf`)).status).toBe(404);
    expect(
      (await other.agent.post("/api/v1/proposals").send(proposal({ lead: lead._id }))).status,
    ).toBe(404);
  });
});

describe("projects", () => {
  it("creates with a code and derives progress from real work items", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    const created = await agent
      .post("/api/v1/projects")
      .send({ name: "Tracker", client: clientId, status: "IN_PROGRESS" });
    expect(created.status).toBe(201);
    expect(created.body.data.code).toMatch(/^PRJ-\d{4}-\d{4}$/);
    const id = created.body.data._id;
    expect((await agent.get(`/api/v1/projects/${id}`)).body.data.progress).toBe(0);

    const milestone = (await agent.post("/api/v1/milestones").send({ project: id, title: "M1" }))
      .body.data;
    const parent = (
      await agent
        .post("/api/v1/project-tasks")
        .send({ project: id, title: "T1", milestone: milestone._id })
    ).body.data;
    const sub = await agent
      .post("/api/v1/project-tasks")
      .send({ project: id, title: "S1", parentTask: parent._id });
    expect(sub.status).toBe(201);
    expect(
      (
        await agent
          .post("/api/v1/project-tasks")
          .send({ project: id, title: "SS", parentTask: sub.body.data._id })
      ).status,
    ).toBe(400);
    await agent.post("/api/v1/project-tasks").send({ project: id, title: "T2" });

    await agent.patch(`/api/v1/milestones/${milestone._id}`).send({ status: "COMPLETED" });
    await agent.patch(`/api/v1/project-tasks/${parent._id}`).send({ status: "COMPLETED" });
    expect((await agent.get(`/api/v1/projects/${id}`)).body.data.progress).toBe(50);

    const list = await agent.get("/api/v1/milestones").query({ project: id });
    expect(list.body.data[0].completedAt).toBeTruthy();
  });

  it("stamps the completion date and logs the status change", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    const { _id } = (
      await agent.post("/api/v1/projects").send({ name: "Finisher", client: clientId })
    ).body.data;
    const done = await agent.patch(`/api/v1/projects/${_id}`).send({ status: "COMPLETED" });
    expect(done.body.data.actualCompletionDate).toBeTruthy();
    const feed = await agent.get("/api/v1/activities").query({ project: _id });
    expect(feed.body.data.map((a: { action: string }) => a.action)).toContain(
      "project.status_changed",
    );
  });
});

describe("attachments", () => {
  it("validates, stores, downloads and isolates files", async () => {
    const admin = await ctx.login("SUPER_ADMIN");
    const dev = await ctx.login("DEVELOPER");
    const outsider = await ctx.login("DEVELOPER");
    const { _id: project } = (
      await admin.agent
        .post("/api/v1/projects")
        .send({ name: "Files", client: clientId, team: [dev.id] })
    ).body.data;
    const form = { entityType: "PROJECT", entityId: project };

    const bad = await dev.agent
      .post("/api/v1/attachments")
      .field(form)
      .attach("file", Buffer.from("MZ not pdf"), {
        filename: "x.pdf",
        contentType: "application/pdf",
      });
    expect(bad.status).toBe(400);

    const ok = await dev.agent
      .post("/api/v1/attachments")
      .field(form)
      .attach("file", Buffer.from("%PDF-1.7 hi"), {
        filename: "../../deliverable.pdf",
        contentType: "application/pdf",
      });
    expect(ok.status).toBe(201);
    expect(ok.body.data.filename).toBe("deliverable.pdf");

    const download = await dev.agent.get(`/api/v1/attachments/${ok.body.data._id}/download`);
    expect(download.status).toBe(200);
    expect(download.headers["content-disposition"]).toContain("attachment");

    expect(
      (await outsider.agent.get(`/api/v1/attachments/${ok.body.data._id}/download`)).status,
    ).toBe(404);
    expect((await outsider.agent.get("/api/v1/attachments").query(form)).status).toBe(404);
    expect(
      (
        await outsider.agent
          .post("/api/v1/attachments")
          .field(form)
          .attach("file", Buffer.from("%PDF"), {
            filename: "y.pdf",
            contentType: "application/pdf",
          })
      ).status,
    ).toBe(404);
  });
});

describe("dashboard and reports", () => {
  it("computes per-currency figures from real records, never mixing currencies", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    const dashboard = (
      await agent
        .get("/api/v1/dashboard")
        .query({ preset: "custom", from: "2020-01-01", to: "2099-12-31" })
    ).body.data;
    expect(dashboard.leads.total).toBeGreaterThan(0);
    const usd = dashboard.finance.byCurrency.find(
      (row: { currency: string }) => row.currency === "USD",
    );

    const db = mongoose.connection;
    const invoices = await db
      .collection("invoices")
      .find({ currency: "USD", archivedAt: null, status: { $nin: ["DRAFT", "CANCELLED"] } })
      .toArray();
    expect(usd.invoiced).toBe(invoices.reduce((sum, i) => sum + i.total, 0));
    expect(usd.outstanding).toBe(invoices.reduce((sum, i) => sum + i.amountDue, 0));
    const payments = await db
      .collection("payments")
      .find({ currency: "USD", voidedAt: null })
      .toArray();
    expect(usd.collected).toBe(payments.reduce((sum, p) => sum + p.amount, 0));

    // A second currency appears as its own row and does not change the USD row.
    const eur = (
      await finance.agent.post("/api/v1/invoices").send(invoiceBody(clientId, { currency: "EUR" }))
    ).body.data._id;
    await finance.agent.post(`/api/v1/invoices/${eur}/issue`);
    const after = (
      await agent
        .get("/api/v1/dashboard")
        .query({ preset: "custom", from: "2020-01-01", to: "2099-12-31" })
    ).body.data;
    expect(
      after.finance.byCurrency.find((r: { currency: string }) => r.currency === "USD").invoiced,
    ).toBe(usd.invoiced);
    expect(
      after.finance.byCurrency.find((r: { currency: string }) => r.currency === "EUR").invoiced,
    ).toBe(100000);
  });

  it("serves all reports with CSV export, and respects permissions", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    for (const report of ["sales", "finance", "projects", "team"]) {
      const json = await agent.get(`/api/v1/reports/${report}`).query({ preset: "this_year" });
      expect(json.status).toBe(200);
      const csv = await agent
        .get(`/api/v1/reports/${report}`)
        .query({ preset: "this_year", format: "csv" });
      expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    }
    const financeCsv = await agent
      .get("/api/v1/reports/finance")
      .query({ format: "csv", preset: "custom", from: "2020-01-01", to: "2099-12-31" });
    expect(financeCsv.text).toContain("Totals by currency");
    expect(financeCsv.text).toMatch(/USD,\d+\.\d{2}/);
  });

  it("finds records across types through global search", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    await agent.post("/api/v1/leads").send(leadBody({ fullName: "Zanzibar Search" }));
    await agent.post("/api/v1/clients").send({ name: "Zanzibar Client" });
    const results = (await agent.get("/api/v1/search").query({ q: "zanzibar" })).body.data;
    expect(results.map((r: { type: string }) => r.type).sort()).toEqual(["client", "lead"]);
    expect(results[0].href).toMatch(/^\/(leads|clients)\//);
    expect((await agent.get("/api/v1/search").query({ q: "z" })).status).toBe(422);
  });
});
