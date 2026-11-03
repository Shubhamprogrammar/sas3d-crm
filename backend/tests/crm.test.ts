import { describe, expect, it } from "vitest";
import { leadBody, setupApp } from "./helpers.js";

const ctx = setupApp();

describe("leads", () => {
  it("creates a lead with its opportunity, activity and history", async () => {
    const { agent } = await ctx.login("SALES");
    const created = await agent.post("/api/v1/leads").send(leadBody());
    expect(created.status).toBe(201);
    const lead = (await agent.get(`/api/v1/leads/${created.body.data._id}`)).body.data;
    expect(lead.status).toBe("NEW");
    expect(lead.opportunity.stage).toBe("NEW");
    const activities = await agent.get("/api/v1/activities").query({ lead: lead._id });
    expect(activities.body.data.map((a: { action: string }) => a.action)).toContain("lead.created");
    const opp = await agent.get(`/api/v1/opportunities/${lead.opportunity._id}`);
    expect(opp.body.data.history).toHaveLength(1);
  });

  it("warns about duplicates, and lets the user explicitly proceed", async () => {
    const { agent } = await ctx.login("SALES");
    const first = leadBody({ email: "dupe@example.com", phone: "+1 (415) 555-0100" });
    expect((await agent.post("/api/v1/leads").send(first)).status).toBe(201);

    const sameEmail = await agent
      .post("/api/v1/leads")
      .send(leadBody({ email: "DUPE@example.com" }));
    expect(sameEmail.status).toBe(409);
    expect(sameEmail.body.errors[0].code).toBe("DUPLICATE_LEAD");

    const samePhone = await agent.post("/api/v1/leads").send(leadBody({ phone: "1 415 555 0100" }));
    expect(samePhone.status).toBe(409);

    const forced = await agent
      .post("/api/v1/leads")
      .send(leadBody({ email: "dupe@example.com", allowDuplicate: true }));
    expect(forced.status).toBe(201);
  });

  it("filters, sorts and paginates", async () => {
    const { agent, id } = await ctx.login("SALES");
    for (const name of ["Zed Page", "Amy Page", "Bob Page"]) {
      await agent
        .post("/api/v1/leads")
        .send(leadBody({ fullName: name, country: "Pagination Land", source: "UPWORK" }));
    }
    const page1 = await agent
      .get("/api/v1/leads")
      .query({ country: "Pagination Land", limit: 2, sortBy: "fullName", sortOrder: "asc" });
    expect(page1.body.data.map((l: { fullName: string }) => l.fullName)).toEqual([
      "Amy Page",
      "Bob Page",
    ]);
    expect(page1.body.meta).toMatchObject({ total: 3, pages: 2, page: 1 });
    const page2 = await agent
      .get("/api/v1/leads")
      .query({
        country: "Pagination Land",
        limit: 2,
        page: 2,
        sortBy: "fullName",
        sortOrder: "asc",
      });
    expect(page2.body.data[0].fullName).toBe("Zed Page");

    expect(
      (await agent.get("/api/v1/leads").query({ search: "amy", source: "UPWORK" })).body.data,
    ).toHaveLength(1);
    expect(
      (await agent.get("/api/v1/leads").query({ source: "FIVERR", assignedTo: id })).body.data,
    ).toHaveLength(0);
  });

  it("archives and restores rather than deleting", async () => {
    const { agent } = await ctx.login("SALES");
    const { _id } = (await agent.post("/api/v1/leads").send(leadBody({ fullName: "Archive Me" })))
      .body.data;
    expect((await agent.delete(`/api/v1/leads/${_id}`)).status).toBe(200);
    expect(
      (await agent.get("/api/v1/leads").query({ search: "Archive Me" })).body.data,
    ).toHaveLength(0);
    expect(
      (await agent.get("/api/v1/leads").query({ search: "Archive Me", archived: "true" })).body
        .data,
    ).toHaveLength(1);
    expect((await agent.post(`/api/v1/leads/${_id}/restore`)).status).toBe(200);
    expect(
      (await agent.get("/api/v1/leads").query({ search: "Archive Me" })).body.data,
    ).toHaveLength(1);
  });

  it("notifies a new assignee", async () => {
    const admin = await ctx.login("ADMIN");
    const sales = await ctx.login("SALES");
    await admin.agent.post("/api/v1/leads").send(leadBody({ assignedTo: sales.id }));
    const notifications = await sales.agent.get("/api/v1/notifications");
    expect(notifications.body.data[0].type).toBe("LEAD_ASSIGNED");
    expect((await sales.agent.get("/api/v1/notifications/unread-count")).body.data.count).toBe(1);
    await sales.agent.post("/api/v1/notifications/read-all");
    expect((await sales.agent.get("/api/v1/notifications/unread-count")).body.data.count).toBe(0);
  });

  it("imports CSV with row-level results and exports safely", async () => {
    const { agent } = await ctx.login("SALES");
    const csv = [
      "Full Name,Email,Country,Source,Priority",
      "Csv One,csv1@example.com,India,LinkedIn,High",
      ",no-name@example.com,India,,",
      "Csv Bad Email,not-an-email,India,,",
      "Csv One Again,csv1@example.com,India,,",
      "=cmd|calc,csv2@example.com,France,Cold Email,",
    ].join("\n");
    const res = await agent
      .post("/api/v1/leads/import")
      .attach("file", Buffer.from(csv), "leads.csv");
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ created: 2, duplicates: 1, failed: 2 });
    expect(res.body.data.errors.map((e: { row: number }) => e.row)).toEqual([3, 4]);

    const exported = await agent.get("/api/v1/leads/export").query({ country: "France" });
    expect(exported.headers["content-type"]).toMatch(/text\/csv/);
    expect(exported.text).toContain("'=cmd|calc");
  });

  it("logs communication and updates contact dates", async () => {
    const { agent } = await ctx.login("SALES");
    const { _id } = (await agent.post("/api/v1/leads").send(leadBody())).body.data;
    const res = await agent
      .post("/api/v1/activities")
      .send({
        lead: _id,
        commType: "PHONE_CALL",
        subject: "Intro call",
        nextFollowUpAt: "2099-01-01T10:00:00Z",
      });
    expect(res.status).toBe(201);
    const lead = (await agent.get(`/api/v1/leads/${_id}`)).body.data;
    expect(lead.lastContactedAt).toBeTruthy();
    expect(lead.nextFollowUpAt).toBe("2099-01-01T10:00:00.000Z");
  });
});

describe("pipeline", () => {
  const newOpp = async (agent: Awaited<ReturnType<typeof ctx.login>>["agent"], overrides = {}) => {
    const { _id } = (await agent.post("/api/v1/leads").send(leadBody(overrides))).body.data;
    const lead = (await agent.get(`/api/v1/leads/${_id}`)).body.data;
    return { leadId: _id as string, oppId: lead.opportunity._id as string };
  };

  it("moves stages, syncs the lead and records history", async () => {
    const { agent } = await ctx.login("SALES");
    const { leadId, oppId } = await newOpp(agent);
    expect(
      (await agent.post(`/api/v1/opportunities/${oppId}/move`).send({ to: "CONTACTED" })).status,
    ).toBe(200);
    expect(
      (await agent.post(`/api/v1/opportunities/${oppId}/move`).send({ to: "INTERESTED" })).status,
    ).toBe(200);
    expect((await agent.get(`/api/v1/leads/${leadId}`)).body.data.status).toBe("INTERESTED");
    const { history } = (await agent.get(`/api/v1/opportunities/${oppId}`)).body.data;
    expect(history.map((h: { to: string }) => h.to)).toEqual(["INTERESTED", "CONTACTED", "NEW"]);
  });

  it("requires a lost reason and stores it", async () => {
    const { agent } = await ctx.login("SALES");
    const { oppId } = await newOpp(agent);
    expect(
      (await agent.post(`/api/v1/opportunities/${oppId}/move`).send({ to: "LOST" })).status,
    ).toBe(400);
    const res = await agent
      .post(`/api/v1/opportunities/${oppId}/move`)
      .send({ to: "LOST", lostReason: "Budget" });
    expect(res.body.data.lostReason).toBe("Budget");
  });

  it("returns a board with per-currency column totals", async () => {
    const { agent } = await ctx.login("SALES");
    await newOpp(agent, { estimatedBudget: 100, budgetCurrency: "USD", fullName: "Board A" });
    await newOpp(agent, { estimatedBudget: 200, budgetCurrency: "USD", fullName: "Board B" });
    await newOpp(agent, { estimatedBudget: 300, budgetCurrency: "INR", fullName: "Board C" });
    const { columns } = (await agent.get("/api/v1/opportunities/board")).body.data;
    const newColumn = columns.find((c: { stage: string }) => c.stage === "NEW");
    expect(newColumn.totals).toEqual(
      expect.arrayContaining([
        { currency: "USD", amount: 300 },
        { currency: "INR", amount: 300 },
      ]),
    );
    expect(newColumn.totals).toHaveLength(2);
  });

  it("converts a won opportunity once, however many times it is requested", async () => {
    const { agent } = await ctx.login("SALES");
    const email = "convert@example.com";
    const { oppId } = await newOpp(agent, { email });
    expect((await agent.post(`/api/v1/opportunities/${oppId}/convert`).send({})).status).toBe(409);
    await agent.post(`/api/v1/opportunities/${oppId}/move`).send({ to: "WON" });

    const first = await agent.post(`/api/v1/opportunities/${oppId}/convert`).send({});
    expect(first.status).toBe(200);
    const second = await agent.post(`/api/v1/opportunities/${oppId}/convert`).send({});
    expect(second.body.data.clientId).toBe(first.body.data.clientId);
    expect(second.body.data.projectId).toBe(first.body.data.projectId);

    const clients = await agent.get("/api/v1/clients").query({ search: email });
    expect(clients.body.data).toHaveLength(1);

    // A project now exists, so the opportunity is locked in WON.
    expect(
      (
        await agent
          .post(`/api/v1/opportunities/${oppId}/move`)
          .send({ to: "LOST", lostReason: "x" })
      ).status,
    ).toBe(409);
  });

  it("survives concurrent conversions without creating duplicates", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    const email = "race@example.com";
    const { oppId } = await newOpp(agent, { email });
    await agent.post(`/api/v1/opportunities/${oppId}/move`).send({ to: "WON" });
    await Promise.allSettled(
      Array.from({ length: 4 }, () =>
        agent.post(`/api/v1/opportunities/${oppId}/convert`).send({}),
      ),
    );
    const clients = await agent.get("/api/v1/clients").query({ search: email });
    expect(clients.body.data).toHaveLength(1);
    const projects = await agent
      .get("/api/v1/projects")
      .query({ client: clients.body.data[0]._id });
    expect(projects.body.data).toHaveLength(1);
  });

  it("reuses an existing client with the same email when converting a lead", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    const client = (
      await agent.post("/api/v1/clients").send({ name: "Existing", email: "existing@example.com" })
    ).body.data;
    const { leadId } = await newOpp(agent, { email: "existing@example.com" });
    const res = await agent.post(`/api/v1/leads/${leadId}/convert`);
    expect(res.body.data.client._id).toBe(client._id);
    const repeat = await agent.post(`/api/v1/leads/${leadId}/convert`);
    expect(repeat.body.data.alreadyConverted).toBe(true);
  });
});

describe("access control", () => {
  it("blocks IDOR between salespeople", async () => {
    const owner = await ctx.login("SALES");
    const other = await ctx.login("SALES");
    const { _id } = (
      await owner.agent.post("/api/v1/leads").send(leadBody({ fullName: "Private Lead" }))
    ).body.data;

    expect((await other.agent.get(`/api/v1/leads/${_id}`)).status).toBe(404);
    expect(
      (await other.agent.patch(`/api/v1/leads/${_id}`).send({ fullName: "Stolen" })).status,
    ).toBe(404);
    expect((await other.agent.delete(`/api/v1/leads/${_id}`)).status).toBe(404);
    expect((await other.agent.post(`/api/v1/leads/${_id}/convert`)).status).toBe(404);
    expect((await other.agent.get("/api/v1/activities").query({ lead: _id })).status).toBe(404);
    expect(
      (
        await other.agent
          .post("/api/v1/activities")
          .send({ lead: _id, commType: "OTHER", subject: "x" })
      ).status,
    ).toBe(404);
    expect((await other.agent.post("/api/v1/tasks").send({ title: "x", lead: _id })).status).toBe(
      404,
    );
    expect(
      (await other.agent.get("/api/v1/leads").query({ search: "Private Lead" })).body.data,
    ).toHaveLength(0);
    expect(
      (await other.agent.get("/api/v1/search").query({ q: "Private Lead" })).body.data,
    ).toHaveLength(0);
    expect(
      (await owner.agent.get("/api/v1/search").query({ q: "Private Lead" })).body.data,
    ).toHaveLength(1);
  });

  it("enforces the role matrix on endpoints", async () => {
    const dev = await ctx.login("DEVELOPER");
    const finance = await ctx.login("FINANCE");
    const sales = await ctx.login("SALES");
    expect((await dev.agent.get("/api/v1/leads")).status).toBe(403);
    expect((await dev.agent.get("/api/v1/clients")).status).toBe(403);
    expect((await dev.agent.get("/api/v1/invoices")).status).toBe(403);
    expect((await dev.agent.get("/api/v1/reports/finance")).status).toBe(403);
    expect((await finance.agent.post("/api/v1/leads").send(leadBody())).status).toBe(403);
    expect((await sales.agent.get("/api/v1/invoices")).status).toBe(403);
    expect((await sales.agent.get("/api/v1/reports/finance")).status).toBe(403);
    expect((await sales.agent.post("/api/v1/team").send({})).status).toBe(403);
    expect((await sales.agent.patch("/api/v1/settings").send({})).status).toBe(403);
  });

  it("removes finance figures from the dashboard for other roles", async () => {
    const sales = await ctx.login("SALES");
    const finance = await ctx.login("FINANCE");
    const salesDash = (await sales.agent.get("/api/v1/dashboard")).body.data;
    expect(salesDash.finance).toBeNull();
    expect(salesDash.leads).not.toBeNull();
    const financeDash = (await finance.agent.get("/api/v1/dashboard")).body.data;
    expect(financeDash.finance).not.toBeNull();
    expect(financeDash.leads).toBeNull();
  });

  it("limits developers to their projects and their own tasks", async () => {
    const pm = await ctx.login("PROJECT_MANAGER");
    const dev = await ctx.login("DEVELOPER");
    const outsider = await ctx.login("DEVELOPER");
    const admin = await ctx.login("ADMIN");
    const client = (await admin.agent.post("/api/v1/clients").send({ name: "Dev Client" })).body
      .data;
    const project = (
      await admin.agent
        .post("/api/v1/projects")
        .send({ name: "Scoped", client: client._id, projectManager: pm.id, team: [dev.id] })
    ).body.data;

    expect((await dev.agent.get(`/api/v1/projects/${project._id}`)).status).toBe(200);
    expect((await outsider.agent.get(`/api/v1/projects/${project._id}`)).status).toBe(404);
    expect(
      (await dev.agent.patch(`/api/v1/projects/${project._id}`).send({ name: "x" })).status,
    ).toBe(403);

    const mine = (
      await pm.agent
        .post("/api/v1/project-tasks")
        .send({ project: project._id, title: "Mine", assignedTo: dev.id })
    ).body.data;
    const theirs = (
      await pm.agent.post("/api/v1/project-tasks").send({ project: project._id, title: "Theirs" })
    ).body.data;
    expect(
      (await dev.agent.patch(`/api/v1/project-tasks/${mine._id}`).send({ status: "COMPLETED" }))
        .status,
    ).toBe(200);
    expect(
      (await dev.agent.patch(`/api/v1/project-tasks/${mine._id}`).send({ title: "Renamed" }))
        .status,
    ).toBe(403);
    expect(
      (await dev.agent.patch(`/api/v1/project-tasks/${theirs._id}`).send({ status: "COMPLETED" }))
        .status,
    ).toBe(403);
    expect(
      (await dev.agent.post("/api/v1/project-tasks").send({ project: project._id, title: "x" }))
        .status,
    ).toBe(403);
    expect(
      (
        await dev.agent
          .post(`/api/v1/projects/${project._id}/updates`)
          .send({ type: "WORK_NOTE", content: "Done" })
      ).status,
    ).toBe(201);

    // A PM cannot manage a project they do not run.
    const otherPm = await ctx.login("PROJECT_MANAGER");
    expect(
      (await otherPm.agent.patch(`/api/v1/projects/${project._id}`).send({ name: "x" })).status,
    ).toBe(404);
  });

  it("protects team management boundaries", async () => {
    const owner = await ctx.login("SUPER_ADMIN");
    const admin = await ctx.login("ADMIN");
    const body = {
      name: "New",
      email: "new-member@example.com",
      password: "long-enough-password",
      role: "SUPER_ADMIN",
    };
    expect((await admin.agent.post("/api/v1/team").send(body)).status).toBe(403);
    expect((await admin.agent.patch(`/api/v1/team/${owner.id}`).send({ name: "x" })).status).toBe(
      403,
    );
    expect(
      (await admin.agent.post("/api/v1/team").send({ ...body, role: "DEVELOPER" })).status,
    ).toBe(201);
    expect(
      (await admin.agent.post("/api/v1/team").send({ ...body, role: "DEVELOPER" })).status,
    ).toBe(409);
    expect(
      (await owner.agent.post(`/api/v1/team/${owner.id}/status`).send({ status: "INACTIVE" }))
        .status,
    ).toBe(409);
  });
});

describe("tasks", () => {
  it("creates, lists by view, completes with an activity, and deletes", async () => {
    const { agent } = await ctx.login("SALES");
    const overdue = (
      await agent.post("/api/v1/tasks").send({ title: "Late", dueAt: "2020-01-01T10:00:00Z" })
    ).body.data;
    await agent.post("/api/v1/tasks").send({ title: "Future", dueAt: "2099-01-01T10:00:00Z" });
    await agent.post("/api/v1/tasks").send({ title: "Today", dueAt: new Date().toISOString() });

    const titles = async (view: string) =>
      (await agent.get("/api/v1/tasks").query({ view })).body.data.map(
        (t: { title: string }) => t.title,
      );
    expect(await titles("overdue")).toContain("Late");
    expect(await titles("upcoming")).toEqual(["Future"]);
    expect(await titles("today")).toContain("Today");

    const done = await agent.patch(`/api/v1/tasks/${overdue._id}`).send({ status: "COMPLETED" });
    expect(done.body.data.completedAt).toBeTruthy();
    expect(await titles("overdue")).not.toContain("Late");

    expect((await agent.delete(`/api/v1/tasks/${overdue._id}`)).status).toBe(200);
    expect((await agent.get(`/api/v1/tasks/${overdue._id}`)).status).toBe(404);
  });
});

describe("scheduled jobs", () => {
  it("creates each reminder once, however often it runs", async () => {
    const { remindFollowUps, remindTasks } = await import("../src/services/jobs.service.js");
    const { agent, id } = await ctx.login("SALES");
    await agent
      .post("/api/v1/tasks")
      .send({
        title: "Reminder task",
        assignedTo: id,
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
      });
    await agent
      .post("/api/v1/leads")
      .send(
        leadBody({ assignedTo: id, nextFollowUpAt: new Date(Date.now() - 3600_000).toISOString() }),
      );

    await remindTasks();
    await remindFollowUps();
    await remindTasks();
    await remindFollowUps();

    const types = (await agent.get("/api/v1/notifications")).body.data.map(
      (n: { type: string }) => n.type,
    );
    expect(types.filter((t: string) => t === "TASK_DEADLINE")).toHaveLength(1);
    expect(types.filter((t: string) => t === "FOLLOW_UP_OVERDUE")).toHaveLength(1);
  });

  it("respects muted notification types", async () => {
    const { remindTasks } = await import("../src/services/jobs.service.js");
    const { agent, id } = await ctx.login("SALES");
    await agent.patch("/api/v1/me").send({ mutedNotifications: ["TASK_DEADLINE"] });
    await agent
      .post("/api/v1/tasks")
      .send({
        title: "Muted",
        assignedTo: id,
        dueAt: new Date(Date.now() + 3600_000).toISOString(),
      });
    await remindTasks();
    expect((await agent.get("/api/v1/notifications")).body.data).toHaveLength(0);
  });
});
