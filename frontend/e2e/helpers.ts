import { expect, type Page } from "@playwright/test";

export const OWNER = { email: "owner@e2e.test", password: "e2e-owner-password" };

export async function login(page: Page, email = OWNER.email, password = OWNER.password) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

export const toast = (page: Page, text: string | RegExp) =>
  expect(page.getByRole("status").filter({ hasText: text }).first()).toBeVisible();
