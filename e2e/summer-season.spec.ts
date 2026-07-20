import { test, expect } from "@playwright/test";

test("summer season filters crops and shows succession sow", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("ZIP code").fill("55423");
  await expect(page.locator("#zip-preview")).toBeVisible({ timeout: 10_000 });
  await page.locator("#season-summer").click();
  await expect(page.locator("#season-summer")).toBeChecked();

  await expect(page.getByRole("checkbox", { name: "Spinach", exact: true })).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Beans", exact: true }).click();
  await page.getByRole("button", { name: "Calculate schedule" }).click();

  await expect(page.getByText("Summer", { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Succession sow Beans/i)).toBeVisible();
});

test("summer plan save and reload keeps season", async ({ page }) => {
  const planName = `E2E summer ${Date.now()}`;
  await page.goto("/");

  await page.getByLabel("ZIP code").fill("55423");
  await expect(page.locator("#zip-preview")).toBeVisible({ timeout: 10_000 });
  await page.locator("#season-summer").click();
  await page.getByRole("checkbox", { name: "Basil", exact: true }).click();
  await page.getByRole("button", { name: "Calculate schedule" }).click();
  await expect(page.getByText(/Sow Basil indoors/i)).toBeVisible();

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
  await expect(page.locator("#season-summer")).toBeChecked();
});
