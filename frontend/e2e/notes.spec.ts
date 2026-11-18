import { expect, test } from "@playwright/test";
import { login, toast } from "./helpers";

test.describe.configure({ mode: "serial" });

// 1x1 PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

test("writes, formats, pins, searches, versions and exports a note", async ({ page }) => {
  const notes = () => page.getByRole("list", { name: "Notes" }).getByRole("listitem");
  await login(page);
  await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Notes" }).click();
  await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
  await expect(page.getByText("No notes yet")).toBeVisible();

  await page.getByRole("button", { name: "New note" }).first().click();
  const drawer = page.getByRole("dialog", { name: "New note" });
  await drawer.getByLabel("Title").fill("Kick-off with Acme");

  const editor = drawer.getByLabel("Note content");
  await editor.click();
  await page.keyboard.type("Agenda for ");
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.type("Monday");
  await page.keyboard.press("ControlOrMeta+b");
  await page.keyboard.press("Enter");
  await page.keyboard.type("- Scope");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Budget");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await drawer.getByRole("button", { name: "Checklist" }).click();
  await page.keyboard.type("Send proposal");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await page.keyboard.type("Owner: @E2E");
  await page.getByRole("option", { name: /E2E Owner/ }).click();
  await drawer.locator('input[type="file"]').setInputFiles({
    name: "dot.png",
    mimeType: "image/png",
    buffer: PNG,
  });
  await expect(editor.locator('img[src^="/api/v1/notes/images/"]')).toBeVisible();

  await expect(editor.locator("strong")).toHaveText("Monday");
  await expect(editor.locator("ul:not([data-type]) li")).toHaveCount(2);
  await expect(editor.locator('ul[data-type="taskList"] > li')).toHaveCount(1);
  await expect(editor.locator('span[data-type="mention"]')).toHaveText("@E2E Owner");

  await drawer.getByLabel("Tags").fill("meeting, Call");
  await page.screenshot({ path: "test-results/notes-editor.png" });
  await drawer.getByRole("button", { name: "Save" }).click();
  await toast(page, "Note created");
  // After saving, the note is shown read-only until "Edit note" is clicked.
  const view = page.getByRole("dialog", { name: "Note", exact: true });
  await expect(view).toBeVisible();
  await expect(view.getByLabel("Title")).toHaveCount(0);
  await expect(view.getByRole("button", { name: "Edit note" })).toBeVisible();
  await view.getByRole("button", { name: "Close" }).last().click();

  const card = notes().filter({ hasText: "Kick-off with Acme" });
  await expect(card).toContainText("Agenda for Monday");
  await expect(card).toContainText("#call");
  await expect(card).toContainText(/Edited by E2E Owner, (just now|\d+ seconds? ago)/);

  // A second note, then pin the first so it sorts to the top.
  await page.getByRole("button", { name: "New note" }).first().click();
  await page.getByRole("dialog", { name: "New note" }).getByLabel("Title").fill("Groceries");
  await page
    .getByRole("dialog", { name: "New note" })
    .getByRole("button", { name: "Save" })
    .click();
  await toast(page, "Note created");
  await view.getByRole("button", { name: "Close" }).last().click();
  await expect(notes().first()).toContainText("Groceries");
  await card.getByRole("button", { name: "Pin Kick-off with Acme" }).click();
  await expect(notes().first()).toContainText("Kick-off with Acme");

  await page.getByRole("searchbox", { name: "Search notes" }).fill("proposal");
  await expect(notes()).toHaveCount(1);
  await page.getByRole("searchbox", { name: "Search notes" }).fill("");

  // Opening a note shows it read-only; cancelling an edit returns to the view.
  await card.getByRole("button", { name: "Kick-off with Acme", exact: true }).click();
  await expect(view.getByRole("heading", { name: "Kick-off with Acme" })).toBeVisible();
  await view.getByRole("button", { name: "Edit note" }).click();
  const edit = page.getByRole("dialog", { name: "Edit note" });
  await edit.getByRole("button", { name: "Cancel" }).click();
  await expect(view.getByRole("button", { name: "Edit note" })).toBeVisible();

  // Edit to create a version, then look at the history.
  await view.getByRole("button", { name: "Edit note" }).click();
  await edit.getByLabel("Title").fill("Kick-off with Acme (v2)");
  await edit.getByRole("button", { name: "Save" }).click();
  await toast(page, "Note saved");
  await expect(view.getByRole("heading", { name: "Kick-off with Acme (v2)" })).toBeVisible();
  await view.getByRole("button", { name: "Close" }).last().click();

  // The pencil on the card opens the note straight into edit mode.
  await card.getByRole("button", { name: "Edit Kick-off with Acme (v2)" }).click();
  await expect(edit.getByLabel("Title")).toHaveValue("Kick-off with Acme (v2)");
  await edit.getByRole("button", { name: "Cancel" }).click();
  await view.getByRole("button", { name: "Note actions" }).click();
  await page.getByRole("menuitem", { name: "Version history" }).click();
  const history = page.getByRole("dialog", { name: "Version history" });
  await expect(
    history.getByRole("heading", { name: "Kick-off with Acme", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/notes-history.png" });
  await history.getByRole("button", { name: "Close" }).first().click();

  await view.getByRole("button", { name: "Note actions" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Download PDF" }).click();
  expect((await download).suggestedFilename()).toBe("Kick-off with Acme v2.pdf");
  await view.getByRole("button", { name: "Close" }).last().click();
  await page.screenshot({ path: "test-results/notes-list.png" });

  // Global search finds notes too.
  await page.getByRole("combobox", { name: /Search leads/ }).fill("Groceries");
  await page.getByRole("option", { name: /Groceries/ }).click();
  await expect(view.getByRole("heading", { name: "Groceries" })).toBeVisible();
});

test("keeps an unsaved draft across a reload and warns before discarding", async ({ page }) => {
  await login(page);
  await page.goto("/notes?new=1");
  const drawer = page.getByRole("dialog", { name: "New note" });
  await drawer.getByLabel("Title").fill("Half-written idea");
  await drawer.getByLabel("Note content").click();
  await page.keyboard.type("Do not lose this");
  await page.waitForTimeout(600);

  page.once("dialog", (dialog) => dialog.accept());
  await page.reload();
  await page.goto("/notes?new=1");
  const restored = page.getByRole("dialog", { name: "New note" });
  await expect(restored.getByText(/Restored unsaved changes/)).toBeVisible();
  await expect(restored.getByLabel("Title")).toHaveValue("Half-written idea");
  await expect(restored.getByLabel("Note content")).toContainText("Do not lose this");

  await restored.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog", { name: "Discard unsaved changes?" })).toBeVisible();
  await page.getByRole("button", { name: "Discard changes" }).click();
  await page.getByRole("button", { name: "New note" }).first().click();
  await expect(page.getByRole("dialog", { name: "New note" }).getByLabel("Title")).toHaveValue("");
});
