import { expect, test } from "@playwright/test";
import { login, toast } from "./helpers";

const STAMP = Date.now();
const LEAD = `Priya Nair ${STAMP}`;
const EMAIL = `priya-${STAMP}@example.com`;

test.describe.configure({ mode: "serial" });

test("rejects bad credentials and redirects anonymous visitors", async ({ page }) => {
  await page.goto("/leads");
  await expect(page).toHaveURL(/\/login\?next=%2Fleads/);
  await page.getByLabel("Email").fill("owner@e2e.test");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Incorrect email or password" }),
  ).toBeVisible();
});

test("runs the whole business lifecycle from lead to paid invoice", async ({ page }) => {
  await login(page);

  // Create a lead through the form.
  await page.goto("/leads");
  await page.getByRole("button", { name: "New lead" }).first().click();
  const drawer = page.getByRole("dialog");
  await drawer.getByRole("button", { name: "Create lead" }).click();
  await expect(drawer.getByText("Full name is required")).toBeVisible();
  await drawer.getByLabel("Full name").fill(LEAD);
  await drawer.getByLabel("Company").fill("Nair Studio");
  await drawer.getByLabel("Email").fill(EMAIL);
  await drawer.getByLabel("Phone").fill(`+971 50 ${String(STAMP).slice(-7)}`);
  await drawer.getByLabel("Country").fill("United Arab Emirates");
  await drawer.getByLabel("Estimated budget").fill("12500.50");
  await drawer.getByLabel("Budget currency").selectOption("USD");
  await drawer.getByLabel("Web Development").check();
  await drawer.getByRole("button", { name: "Create lead" }).click();
  await expect(page).toHaveURL(/\/leads\/[a-f0-9]{24}/);
  await expect(page.getByRole("heading", { name: LEAD })).toBeVisible();
  await expect(page.getByText("USD 12,500.50")).toBeVisible();

  // The duplicate warning appears, and creating anyway stays an explicit choice.
  await page.goto("/leads");
  await page.getByRole("button", { name: "New lead" }).first().click();
  await drawer.getByLabel("Full name").fill(`${LEAD} copy`);
  await drawer.getByLabel("Email").fill(EMAIL);
  await drawer.getByRole("button", { name: "Create lead" }).click();
  await expect(drawer.getByText("Possible duplicate")).toBeVisible();
  await expect(drawer.getByRole("button", { name: "Create anyway" })).toBeVisible();
  await drawer.getByRole("button", { name: "Cancel" }).click();

  // Drag the card through the pipeline; stage history persists across a reload.
  await page.goto("/pipeline");
  const card = page.getByTestId("pipeline-card").filter({ hasText: LEAD });
  await expect(card).toBeVisible();
  await expect(
    page.locator('[data-stage="NEW"]').getByTestId("pipeline-card").filter({ hasText: LEAD }),
  ).toBeVisible();
  await card.dragTo(page.locator('[data-stage="CONTACTED"]'));
  await expect(
    page.locator('[data-stage="CONTACTED"]').getByTestId("pipeline-card").filter({ hasText: LEAD }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.locator('[data-stage="CONTACTED"]').getByTestId("pipeline-card").filter({ hasText: LEAD }),
  ).toBeVisible();

  // Dragging to Lost requires a reason, so cancelling leaves the card where it was.
  await card.getByRole("button", { name: /^Move / }).click();
  await page.getByRole("menuitem", { name: "Move to Lost" }).click();
  await expect(
    page.getByRole("dialog").getByRole("heading", { name: "Mark as lost" }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByRole("button", { name: "Mark as lost" }),
  ).toBeDisabled();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.locator('[data-stage="CONTACTED"]').getByTestId("pipeline-card").filter({ hasText: LEAD }),
  ).toBeVisible();

  // Winning prompts for conversion to a client and project.
  await card.getByRole("button", { name: /^Move / }).click();
  await page.getByRole("menuitem", { name: "Move to Won" }).click();
  const convert = page.getByRole("dialog");
  await expect(convert.getByRole("heading", { name: "Convert won opportunity" })).toBeVisible();
  await convert.getByLabel("Project name").fill(`Nair Portal ${STAMP}`);
  await convert.getByRole("button", { name: "Convert" }).click();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9]{24}/);
  await expect(page.getByRole("heading", { name: `Nair Portal ${STAMP}` })).toBeVisible();
  const projectUrl = page.url();

  // Project progress comes from real work items.
  await page.getByRole("tab", { name: /Milestones/ }).click();
  await page.getByRole("button", { name: "Add milestone" }).click();
  await page.getByRole("dialog").getByLabel("Title").fill("Discovery");
  await page.getByRole("dialog").getByLabel("Status").selectOption("COMPLETED");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await toast(page, "Milestone created");
  await page.getByRole("tab", { name: /Tasks/ }).click();
  await page.getByRole("button", { name: "Add task" }).click();
  await page.getByRole("dialog").getByLabel("Title").fill("Build homepage");
  await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
  await toast(page, "Task created");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");

  // Client exists exactly once.
  await page.goto("/clients");
  await page.getByRole("searchbox", { name: "Search clients" }).fill(EMAIL);
  await expect(page.getByRole("row").filter({ hasText: EMAIL })).toHaveCount(1);
  await page.getByRole("row").filter({ hasText: EMAIL }).click();
  await expect(page).toHaveURL(/\/clients\/[a-f0-9]{24}/);
  const clientId = page.url().split("/").pop();

  // Create a proposal; totals come from the server.
  await page.goto(`/proposals/new?client=${clientId}`);
  await page.getByLabel("Project title").fill(`Portal proposal ${STAMP}`);
  await page.getByLabel("Currency").selectOption("USD");
  await page.getByLabel("Description", { exact: true }).first().fill("Customer portal");
  await page.getByTestId("line-item").getByLabel("Description").fill("Portal build");
  await page.getByTestId("line-item").getByLabel("Qty").fill("3");
  await page.getByTestId("line-item").getByLabel("Unit price").fill("19.99");
  await page.getByLabel("Tax rate %").fill("10");
  await expect(page.getByTestId("total")).toHaveText("USD 65.97");
  await page.getByRole("button", { name: "Create proposal" }).click();
  await expect(page).toHaveURL(/\/proposals\/[a-f0-9]{24}$/);

  // Without a provider, email must fail visibly and leave the proposal as a draft.
  await page.getByRole("button", { name: "Email to client" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText("was not sent");
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Draft", { exact: true })).toBeVisible();

  const [pdf] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download PDF" }).click(),
  ]);
  expect(pdf.suggestedFilename()).toMatch(/^PROP-\d{4}-\d{4}\.pdf$/);

  // Create and issue an invoice for the project.
  await page.goto(`/invoices/new?client=${clientId}&project=${projectUrl.split("/").pop()}`);
  await page.getByLabel("Currency").selectOption("USD");
  await page.getByTestId("line-item").getByLabel("Description").fill("Portal milestone 1");
  await page.getByTestId("line-item").getByLabel("Unit price").fill("1000");
  await expect(page.getByTestId("total")).toHaveText("USD 1,000.00");
  await page.getByRole("button", { name: "Create draft" }).click();
  await expect(page).toHaveURL(/\/invoices\/[a-f0-9]{24}$/);
  await page.getByRole("button", { name: "Issue invoice" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Issue invoice" }).click();
  await toast(page, "Invoice marked as sent");

  // Partial payment, a rejected overpayment, then the remainder.
  await page.getByRole("button", { name: "Record payment" }).click();
  const payment = page.getByRole("dialog");
  await payment.getByLabel("Amount (USD)").fill("400.25");
  await payment.getByLabel("Transaction reference").fill(`SWIFT-${STAMP}`);
  await payment.getByLabel("Method").selectOption("SWIFT");
  await payment.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByTestId("balance-due")).toHaveText("USD 599.75");
  await expect(page.getByText("Partially paid").first()).toBeVisible();

  await page.getByRole("button", { name: "Record payment" }).click();
  await payment.getByLabel("Amount (USD)").fill("600");
  await payment.getByRole("button", { name: "Record payment" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "exceeds the outstanding balance" }),
  ).toBeVisible();
  await payment.getByLabel("Amount (USD)").fill("599.75");
  await payment.getByRole("button", { name: "Record payment" }).click();
  await expect(page.getByTestId("balance-due")).toHaveText("USD 0.00");
  await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();

  // The dashboard reflects those records.
  await page.goto("/dashboard");
  const usd = page.getByTestId("finance-table").locator('[data-currency="USD"]');
  await expect(usd).toContainText("USD 1,000.00");
  await expect(usd.locator("td").nth(3)).toHaveText("USD 0.00");
  await expect(page.getByTestId("stat-Total clients")).not.toHaveText("0");

  // Global search navigates to a record.
  await page.getByRole("combobox", { name: /Search leads/ }).fill(`Nair Portal ${STAMP}`);
  await page
    .getByRole("option")
    .filter({ hasText: `Nair Portal ${STAMP}` })
    .click();
  await expect(page).toHaveURL(projectUrl);
});

test("hides and blocks what a role may not use", async ({ page }) => {
  await login(page);
  const email = `dev-${STAMP}@example.com`;
  await page.goto("/team");
  await page.getByRole("button", { name: "New member" }).click();
  const drawer = page.getByRole("dialog");
  await drawer.getByLabel("Name").fill("Dev Person");
  await drawer.getByLabel("Email").fill(email);
  await drawer.getByLabel("Initial password").fill("a-long-dev-password");
  await drawer.getByLabel(/^Role/).selectOption("DEVELOPER");
  await drawer.getByRole("button", { name: "Save" }).click();
  await toast(page, "Team member created");

  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login/);

  await login(page, email, "a-long-dev-password");
  const nav = page.getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Projects" })).toBeVisible();
  for (const hidden of ["Leads", "Invoices & Payments", "Reports", "Settings"]) {
    await expect(nav.getByRole("link", { name: hidden })).toHaveCount(0);
  }
  const blocked = await page.request.get("/api/v1/invoices");
  expect(blocked.status()).toBe(403);
  await page.goto("/invoices");
  await expect(page.getByText("You do not have permission")).toBeVisible();
});

test("works at phone width without horizontal page scroll", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await login(page);
  for (const path of [
    "/dashboard",
    "/leads",
    "/clients",
    "/tasks",
    "/proposals",
    "/projects",
    "/invoices",
    "/services",
    "/team",
    "/reports",
    "/settings",
  ]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `${path} overflows horizontally`).toBeLessThanOrEqual(0);
  }
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("link", { name: "Pipeline" }).click();
  await expect(page).toHaveURL(/\/pipeline/);
});

test("switches and remembers the dark theme", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/dashboard");
  await expect(page.getByRole("button", { name: "Switch to light theme" })).toBeVisible();
});
