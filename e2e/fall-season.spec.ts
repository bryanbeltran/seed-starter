import { test, expect } from "@playwright/test";

test("fall season filters crops and shows first fall frost", async ({ page }) => {
  await page.goto("/");

  await page.locator("#season-fall").click();
  await expect(page.locator("#season-fall")).toBeChecked();

  await expect(page.getByRole("checkbox", { name: "Tomato", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Lettuce", exact: true }).click();

  await page.getByLabel("ZIP code").fill("55423");
  await page.getByRole("button", { name: "Calculate schedule" }).click();

  await expect(page.locator("#zip-preview")).toContainText(/first fall frost/i);
  await expect(page.getByText("Sow Lettuce indoors", { exact: true })).toBeVisible();
});

test("fall plan save and reload keeps season", async ({ page }) => {
  const planName = `E2E fall ${Date.now()}`;
  await page.goto("/");

  await page.locator("#season-fall").click();
  await page.getByLabel("ZIP code").fill("55423");
  await page.getByRole("checkbox", { name: "Kale", exact: true }).click();
  await page.getByRole("button", { name: "Calculate schedule" }).click();
  await expect(page.locator("#zip-preview")).toContainText(/first fall frost/i);

  await page.getByRole("button", { name: "Save plan" }).click();
  await page.getByLabel("Plan name").fill(planName);
  await page.getByRole("button", { name: "Save", exact: true }).click();

  const planButton = page
    .locator("aside")
    .getByRole("button")
    .filter({ hasText: planName })
    .first();
  await expect(planButton).toBeVisible({ timeout: 10_000 });
  await planButton.click();

  await expect(page.getByRole("status").filter({ hasText: /Loaded plan/ }).first()).toBeVisible();
  await expect(page.locator("#season-fall")).toBeChecked();
  await expect(page.locator("#zip-preview")).toContainText(/first fall frost/i);
});
