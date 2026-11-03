import { describe, expect, it } from "vitest";
process.env.MONGODB_URI ??= "mongodb://placeholder/test";
const { calculateTotals, formatMinor, lineAmount, minorToDecimal } =
  await import("../src/utils/money.js");
const { deriveInvoiceStatus } = await import("../src/modules/invoices/balance.js");
const { assertTransition, conversionRate, shouldAutoAdvance } =
  await import("../src/modules/opportunities/transitions.js");
const { canManageRole, hasPermission, PERMISSIONS } = await import("../src/config/permissions.js");
const { calculateProgress } = await import("../src/modules/projects/progress.js");
const { assertProposalTransition } = await import("../src/modules/proposals/status.js");
const { createLeadSchema } = await import("../src/modules/leads/validator.js");
const { csvSafe } = await import("../src/utils/csv.js");
const { isPastDue, resolveRange, startOfDayInZone } = await import("../src/utils/dates.js");
const { formatNumber } = await import("../src/services/numbering.service.js");
const { assertAllowedFile } = await import("../src/services/storage.service.js");

describe("money", () => {
  it("avoids the floating-point error that 0.1 + 0.2 style sums produce", () => {
    // 3 x 19.99 is 59.97 exactly; float arithmetic on major units gives 59.97000000000001.
    expect(lineAmount({ quantity: 3, unitPrice: 1999 })).toBe(5997);
    expect(
      calculateTotals(
        [
          { quantity: 1, unitPrice: 10 },
          { quantity: 1, unitPrice: 20 },
        ],
        undefined,
        0,
      ).total,
    ).toBe(30);
  });
  it("rounds fractional quantities half up", () => {
    expect(lineAmount({ quantity: 1.5, unitPrice: 333 })).toBe(500); // 499.5
    expect(lineAmount({ quantity: 0.333, unitPrice: 100 })).toBe(33);
  });
  it("rejects quantities with more than three decimals", () => {
    expect(() => lineAmount({ quantity: 1.2345, unitPrice: 100 })).toThrow(RangeError);
  });
  it("applies percent discount before tax", () => {
    const totals = calculateTotals(
      [{ quantity: 2, unitPrice: 50000 }],
      { type: "PERCENT", value: 1000 },
      1800,
    );
    expect(totals).toMatchObject({
      subtotal: 100000,
      discountAmount: 10000,
      taxAmount: 16200,
      total: 106200,
    });
  });
  it("applies a fixed discount and refuses one above the subtotal", () => {
    expect(
      calculateTotals([{ quantity: 1, unitPrice: 1000 }], { type: "FIXED", value: 250 }, 0).total,
    ).toBe(750);
    expect(() =>
      calculateTotals([{ quantity: 1, unitPrice: 1000 }], { type: "FIXED", value: 1001 }, 0),
    ).toThrow(RangeError);
  });
  it("handles amounts where a double would lose precision in intermediates", () => {
    const totals = calculateTotals(
      [{ quantity: 1000, unitPrice: 900_000_000_000 }],
      undefined,
      1800,
    );
    expect(totals.total).toBe(1_062_000_000_000_000);
  });
  it("formats without floats", () => {
    expect(formatMinor(123456789, "USD")).toBe("USD 1,234,567.89");
    expect(formatMinor(5, "EUR")).toBe("EUR 0.05");
    expect(minorToDecimal(100)).toBe("1.00");
  });
});

describe("invoice status", () => {
  const base = { status: "SENT" as const, total: 1000, amountPaid: 0, pastDue: false };
  it("derives each state from the balance", () => {
    expect(deriveInvoiceStatus(base)).toBe("SENT");
    expect(deriveInvoiceStatus({ ...base, amountPaid: 1 })).toBe("PARTIALLY_PAID");
    expect(deriveInvoiceStatus({ ...base, amountPaid: 1000 })).toBe("PAID");
    expect(deriveInvoiceStatus({ ...base, pastDue: true })).toBe("OVERDUE");
    expect(deriveInvoiceStatus({ ...base, amountPaid: 500, pastDue: true })).toBe("OVERDUE");
  });
  it("treats paid as winning over overdue", () => {
    expect(deriveInvoiceStatus({ ...base, amountPaid: 1000, pastDue: true })).toBe("PAID");
  });
  it("leaves draft and cancelled alone", () => {
    expect(deriveInvoiceStatus({ ...base, status: "DRAFT", amountPaid: 1000 })).toBe("DRAFT");
    expect(deriveInvoiceStatus({ ...base, status: "CANCELLED", pastDue: true })).toBe("CANCELLED");
  });
});

describe("pipeline rules", () => {
  it("requires a reason for LOST", () => {
    expect(() => assertTransition("NEW", "LOST", { hasProject: false })).toThrow(/lost reason/i);
    expect(() =>
      assertTransition("NEW", "LOST", { lostReason: "  ", hasProject: false }),
    ).toThrow();
    expect(() =>
      assertTransition("NEW", "LOST", { lostReason: "Budget", hasProject: false }),
    ).not.toThrow();
  });
  it("blocks a no-op and leaving WON once a project exists", () => {
    expect(() => assertTransition("NEW", "NEW", { hasProject: false })).toThrow();
    expect(() => assertTransition("WON", "NEGOTIATION", { hasProject: true })).toThrow(
      /cannot leave WON/,
    );
    expect(() => assertTransition("WON", "NEGOTIATION", { hasProject: false })).not.toThrow();
  });
  it("auto-advances only forward and never reopens outcomes", () => {
    expect(shouldAutoAdvance("NEW", "PROPOSAL_SENT")).toBe(true);
    expect(shouldAutoAdvance("NEGOTIATION", "PROPOSAL_SENT")).toBe(false);
    expect(shouldAutoAdvance("LOST", "WON")).toBe(false);
    expect(shouldAutoAdvance("WON", "WON")).toBe(false);
  });
  it("computes win rate and handles no closed deals", () => {
    expect(conversionRate(1, 2)).toBe(33.3);
    expect(conversionRate(0, 0)).toBe(0);
  });
});

describe("permissions", () => {
  it("grants the super admin everything", () => {
    for (const permission of PERMISSIONS)
      expect(hasPermission("SUPER_ADMIN", permission)).toBe(true);
  });
  it("keeps finance away from leads and developers away from money", () => {
    expect(hasPermission("FINANCE", "lead:read")).toBe(false);
    expect(hasPermission("DEVELOPER", "invoice:read")).toBe(false);
    expect(hasPermission("DEVELOPER", "report:finance")).toBe(false);
    expect(hasPermission("SALES", "payment:write")).toBe(false);
    expect(hasPermission("PROJECT_MANAGER", "invoice:read")).toBe(false);
  });
  it("stops admins from managing their peers or superiors", () => {
    expect(canManageRole("ADMIN", "SALES")).toBe(true);
    expect(canManageRole("ADMIN", "ADMIN")).toBe(false);
    expect(canManageRole("ADMIN", "SUPER_ADMIN")).toBe(false);
    expect(canManageRole("SUPER_ADMIN", "SUPER_ADMIN")).toBe(true);
    expect(canManageRole("SALES", "DEVELOPER")).toBe(false);
  });
});

describe("project progress", () => {
  it("is computed from real items and ignores cancelled ones", () => {
    expect(calculateProgress([])).toBe(0);
    expect(calculateProgress([{ status: "COMPLETED" }, { status: "TODO" }])).toBe(50);
    expect(calculateProgress([{ status: "COMPLETED" }, { status: "CANCELLED" }])).toBe(100);
    expect(calculateProgress([{ status: "CANCELLED" }])).toBe(0);
  });
});

describe("proposal status", () => {
  it("allows only defined moves", () => {
    expect(() => assertProposalTransition("DRAFT", "SENT")).not.toThrow();
    expect(() => assertProposalTransition("DRAFT", "ACCEPTED")).toThrow();
    expect(() => assertProposalTransition("ACCEPTED", "REJECTED")).toThrow();
  });
});

describe("validation", () => {
  it("accepts a minimal international lead", () => {
    expect(
      createLeadSchema.safeParse({
        fullName: "Yuki Tanaka",
        phone: "+81 3-1234-5678",
        timezone: "Asia/Tokyo",
      }).success,
    ).toBe(true);
  });
  it("rejects bad email, timezone and dangerous URLs", () => {
    expect(createLeadSchema.safeParse({ fullName: "A", email: "nope" }).success).toBe(false);
    expect(createLeadSchema.safeParse({ fullName: "A", timezone: "Mars/Base" }).success).toBe(
      false,
    );
    expect(
      createLeadSchema.safeParse({ fullName: "A", website: "javascript:alert(1)" }).success,
    ).toBe(false);
  });
  it("rejects fractional minor units", () => {
    expect(createLeadSchema.safeParse({ fullName: "A", estimatedBudget: 10.5 }).success).toBe(
      false,
    );
  });
  it("does not apply defaults on partial updates", async () => {
    const { updateLeadSchema } = await import("../src/modules/leads/validator.js");
    expect(updateLeadSchema.parse({})).toEqual({});
  });
});

describe("csv safety", () => {
  it("neutralises formulas but leaves phone numbers and negatives", () => {
    expect(csvSafe("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvSafe("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvSafe("+1 (415) 555-0100")).toBe("+1 (415) 555-0100");
    expect(csvSafe("-12.50")).toBe("-12.50");
    expect(csvSafe("+cmd|x")).toBe("'+cmd|x");
  });
});

describe("dates", () => {
  it("finds the start of day in a zone", () => {
    expect(startOfDayInZone(new Date("2026-06-15T20:00:00Z"), "Asia/Kolkata").toISOString()).toBe(
      "2026-06-15T18:30:00.000Z",
    );
    expect(
      startOfDayInZone(new Date("2026-06-15T02:00:00Z"), "America/New_York").toISOString(),
    ).toBe("2026-06-14T04:00:00.000Z");
  });
  it("resolves presets in the company zone", () => {
    const now = new Date("2026-03-15T12:00:00Z");
    const month = resolveRange("this_month", "UTC", {}, now);
    expect(month.from.toISOString()).toBe("2026-03-01T00:00:00.000Z");
    expect(month.to.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    const last = resolveRange("last_month", "UTC", {}, new Date("2026-01-15T12:00:00Z"));
    expect(last.from.toISOString()).toBe("2025-12-01T00:00:00.000Z");
    expect(resolveRange("last_7_days", "UTC", {}, now).from.toISOString()).toBe(
      "2026-03-09T00:00:00.000Z",
    );
  });
  it("includes the whole final day of a custom range", () => {
    const range = resolveRange("custom", "UTC", {
      from: new Date("2026-01-01"),
      to: new Date("2026-01-31"),
    });
    expect(range.to.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });
  it("makes an invoice overdue only after its due date ends in the company zone", () => {
    const due = new Date("2026-03-10");
    expect(isPastDue(due, "UTC", new Date("2026-03-10T23:59:00Z"))).toBe(false);
    expect(isPastDue(due, "UTC", new Date("2026-03-11T00:00:00Z"))).toBe(true);
    // 11 March 00:30 in Kolkata is still 10 March 19:00 UTC.
    expect(isPastDue(due, "Asia/Kolkata", new Date("2026-03-10T19:00:00Z"))).toBe(true);
  });
});

describe("document numbers", () => {
  it("formats with and without a year", () => {
    expect(formatNumber({ prefix: "INV", padding: 4, includeYear: true }, 7, 2026)).toBe(
      "INV-2026-0007",
    );
    expect(formatNumber({ prefix: "P", padding: 3, includeYear: false }, 12, 2026)).toBe("P-012");
  });
});

describe("file validation", () => {
  it("checks type allowlist and magic bytes", () => {
    expect(() => assertAllowedFile(Buffer.from("%PDF-1.7"), "application/pdf")).not.toThrow();
    expect(() => assertAllowedFile(Buffer.from("<script>"), "application/pdf")).toThrow(
      /do not match/,
    );
    expect(() => assertAllowedFile(Buffer.from("MZ"), "application/x-msdownload")).toThrow(
      /not allowed/,
    );
    expect(() => assertAllowedFile(Buffer.from([0, 1, 2]), "text/plain")).toThrow();
  });
});
