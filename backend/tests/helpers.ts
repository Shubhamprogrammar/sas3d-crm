import { randomUUID } from "node:crypto";
import type { Express } from "express";
import mongoose from "mongoose";
import request from "supertest";
import { afterAll, beforeAll, inject } from "vitest";
import type { Role } from "../src/config/constants.js";

process.env.MONGODB_URI ??= "mongodb://placeholder/test";

export const PASSWORD = "correct-horse-battery";

export interface TestApp {
  app: Express;
  /** Signs in as a new user of this role and returns an authenticated agent. */
  login: (
    role: Role,
    overrides?: { email?: string },
  ) => Promise<{ agent: ReturnType<typeof request.agent>; id: string; email: string }>;
}

export function setupApp() {
  const context = {} as TestApp;

  beforeAll(async () => {
    const { createApp } = await import("../src/app.js");
    const { provisionUser, resetAuth } = await import("../src/config/auth.js");
    const { initDatabase } = await import("../src/database/models.js");
    const { connectDatabase } = await import("../src/database/connection.js");

    await connectDatabase(inject("mongoUri"));
    await mongoose.connection.dropDatabase();
    await initDatabase();
    resetAuth();

    context.app = createApp();
    context.login = async (role, overrides = {}) => {
      const email = overrides.email ?? `${role.toLowerCase()}-${randomUUID()}@example.com`;
      const user = await provisionUser({ name: `${role} User`, email, password: PASSWORD, role });
      const agent = request.agent(context.app);
      const response = await agent
        .post("/api/v1/auth/sign-in/email")
        .send({ email, password: PASSWORD });
      if (response.status !== 200)
        throw new Error(`Login failed: ${response.status} ${response.text}`);
      return { agent, id: user.id, email };
    };
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  return context;
}

export const leadBody = (overrides: Record<string, unknown> = {}) => ({
  fullName: "Ada Lovelace",
  companyName: "Analytical Ltd",
  email: `ada-${randomUUID()}@example.com`,
  phone: "",
  country: "United Kingdom",
  source: "LINKEDIN",
  estimatedBudget: 500000,
  budgetCurrency: "GBP",
  ...overrides,
});

export const invoiceBody = (client: string, overrides: Record<string, unknown> = {}) => ({
  client,
  issueDate: "2026-01-01",
  dueDate: "2099-01-31",
  currency: "USD",
  items: [{ description: "Build", quantity: 1, unitPrice: 100000 }],
  ...overrides,
});
