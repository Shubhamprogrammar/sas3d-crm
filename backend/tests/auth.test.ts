import mongoose from "mongoose";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { leadBody, PASSWORD, setupApp } from "./helpers.js";

const ctx = setupApp();

describe("authentication", () => {
  it("rejects unauthenticated API access", async () => {
    for (const path of [
      "/api/v1/me",
      "/api/v1/leads",
      "/api/v1/invoices",
      "/api/v1/dashboard",
      "/api/v1/settings",
    ]) {
      expect((await request(ctx.app).get(path)).status).toBe(401);
    }
  });

  it("exposes a public health check", async () => {
    const res = await request(ctx.app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.data.database).toBe("connected");
  });

  it("disables public sign-up", async () => {
    const res = await request(ctx.app)
      .post("/api/v1/auth/sign-up/email")
      .send({ name: "X", email: "x@example.com", password: PASSWORD });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(
      await mongoose.connection.collection("user").findOne({ email: "x@example.com" }),
    ).toBeNull();
  });

  it("signs in, returns the profile and permissions, and logs out", async () => {
    const { agent, email } = await ctx.login("SALES");
    const me = await agent.get("/api/v1/me");
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe(email);
    expect(me.body.data.permissions).toContain("lead:read");
    expect(me.body.data.permissions).not.toContain("invoice:read");

    expect((await agent.post("/api/v1/auth/sign-out").send({})).status).toBe(200);
    expect((await agent.get("/api/v1/me")).status).toBe(401);
  });

  // An attacker can request a reset naming their own site; the victim then clicks the real email.
  it("always links reset emails to the configured frontend, whatever the request says", async () => {
    const { setEmailProvider } = await import("../src/services/email.service.js");
    const sent: string[] = [];
    setEmailProvider({
      send: async (m) => {
        sent.push(m.html);
        return { sent: true };
      },
    });
    const { email } = await ctx.login("SALES");
    await request(ctx.app)
      .post("/api/v1/auth/request-password-reset")
      .send({ email, redirectTo: "https://evil.example/steal" });
    expect(sent[0]).not.toContain("evil.example");
    expect(sent[0]).toMatch(/href="http:\/\/localhost:3000\/reset-password\?token=[^"]+"/);
  });

  it("rejects a wrong password", async () => {
    const { email } = await ctx.login("SALES");
    const res = await request(ctx.app)
      .post("/api/v1/auth/sign-in/email")
      .send({ email, password: "wrong-password-123" });
    expect(res.status).toBe(401);
  });

  it("never exposes credentials through the user-facing API", async () => {
    const { agent, id } = await ctx.login("SUPER_ADMIN");
    for (const path of ["/api/v1/me", "/api/v1/team", `/api/v1/team/${id}`]) {
      const text = (await agent.get(path)).text;
      expect(text).not.toMatch(/password/i);
    }
  });

  it("cannot self-assign a role through the auth or profile APIs", async () => {
    const { agent, id } = await ctx.login("DEVELOPER");
    await agent
      .post("/api/v1/auth/update-user")
      .send({ name: "Hacker", role: "SUPER_ADMIN", status: "ACTIVE" });
    const patched = await agent.patch("/api/v1/me").send({ role: "SUPER_ADMIN" });
    expect(patched.status).toBe(200);
    const user = await mongoose.connection
      .collection("user")
      .findOne({ _id: new mongoose.Types.ObjectId(id) });
    expect(user?.role).toBe("DEVELOPER");
    expect((await agent.get("/api/v1/invoices")).status).toBe(403);
  });

  it("revokes access at once when a user is deactivated, and blocks new sign-ins", async () => {
    const admin = await ctx.login("SUPER_ADMIN");
    const sales = await ctx.login("SALES");
    expect((await sales.agent.get("/api/v1/leads")).status).toBe(200);
    expect(
      (await admin.agent.post(`/api/v1/team/${sales.id}/status`).send({ status: "INACTIVE" }))
        .status,
    ).toBe(200);
    expect((await sales.agent.get("/api/v1/leads")).status).toBeGreaterThanOrEqual(401);
    const again = await request(ctx.app)
      .post("/api/v1/auth/sign-in/email")
      .send({ email: sales.email, password: PASSWORD });
    expect(again.status).toBeGreaterThanOrEqual(400);
    expect(String(again.headers["set-cookie"] ?? "")).not.toMatch(/session_token=[^;]{10,}/);
  });

  it("applies a role change on the very next request", async () => {
    const admin = await ctx.login("SUPER_ADMIN");
    const user = await ctx.login("FINANCE");
    expect((await user.agent.get("/api/v1/invoices")).status).toBe(200);
    await admin.agent.patch(`/api/v1/team/${user.id}`).send({ role: "DEVELOPER" });
    expect((await user.agent.get("/api/v1/invoices")).status).toBe(403);
  });

  it("changes password and resets via token", async () => {
    const { setEmailProvider } = await import("../src/services/email.service.js");
    const sent: string[] = [];
    setEmailProvider({
      send: async (m) => {
        sent.push(m.html);
        return { sent: true };
      },
    });

    const { agent, email } = await ctx.login("SALES");
    const changed = await agent
      .post("/api/v1/auth/change-password")
      .send({ currentPassword: PASSWORD, newPassword: "a-brand-new-password" });
    expect(changed.status).toBe(200);

    await request(ctx.app)
      .post("/api/v1/auth/request-password-reset")
      .send({ email, redirectTo: "http://localhost:3000/reset-password" });
    expect(sent).toHaveLength(1);
    const token = sent[0]?.match(/reset-password\?token=([^"]+)/)?.[1];
    expect(token).toBeTruthy();
    const reset = await request(ctx.app)
      .post("/api/v1/auth/reset-password")
      .send({ token, newPassword: "yet-another-password" });
    expect(reset.status).toBe(200);
    const login = await request(ctx.app)
      .post("/api/v1/auth/sign-in/email")
      .send({ email, password: "yet-another-password" });
    expect(login.status).toBe(200);
    // The token is single-use.
    expect(
      (
        await request(ctx.app)
          .post("/api/v1/auth/reset-password")
          .send({ token, newPassword: "and-one-more-password" })
      ).status,
    ).toBe(400);
  });
});

describe("request hardening", () => {
  it("rejects NoSQL operators in bodies and query strings", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    expect((await agent.post("/api/v1/leads").send({ fullName: { $ne: null } })).status).toBe(400);
    expect((await agent.get("/api/v1/leads?status[$ne]=NEW")).status).toBe(400);
  });

  it("treats search input as a literal string", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    await agent.post("/api/v1/leads").send(leadBody({ fullName: "Regex Target" }));
    const res = await agent.get("/api/v1/leads").query({ search: ".*" });
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
  });

  it("refuses writes from an origin outside the allowlist", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    const res = await agent
      .post("/api/v1/leads")
      .set("Origin", "https://evil.example")
      .send(leadBody());
    expect(res.status).toBe(403);
  });

  it("returns validation errors in the documented format", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    const res = await agent.post("/api/v1/leads").send({ fullName: "" });
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors[0].path).toBe("fullName");
    expect(res.body.stack).toBeUndefined();
  });

  it("rejects malformed identifiers", async () => {
    const { agent } = await ctx.login("SUPER_ADMIN");
    expect((await agent.get("/api/v1/leads/not-an-id")).status).toBe(422);
  });
});
