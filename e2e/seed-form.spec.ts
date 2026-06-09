import { test, expect } from "@playwright/test";

test("calculates schedule from fixture zip", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("ZIP code").fill("55423");
  await page.getByLabel("Tomato").click();
  await page.getByRole("button", { name: "Calculate schedule" }).click();
  await expect(page.getByText("Zone 5A", { exact: true })).toBeVisible();
  await expect(page.getByText(/Sow Tomato/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Print schedule" })).toBeVisible();
});

test("saves and reopens a plan", async ({ page }) => {
  const planName = `E2E bed ${Date.now()}`;
  await page.goto("/");
  await page.getByLabel("ZIP code").fill("55423");
  await page.getByLabel("Lettuce").click();
  await page.getByRole("button", { name: "Calculate schedule" }).click();
  await expect(page.getByText("Zone 5A", { exact: true })).toBeVisible();

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
  await expect(page.getByText(/Loaded plan/)).toBeVisible();
});

test("compares risk profiles", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("ZIP code").fill("55423");
  await page.getByLabel("Tomato").click();
  await page.getByLabel("Compare risk profiles").click();
  await page.getByRole("button", { name: "Calculate schedule" }).click();
  await expect(page.getByRole("tab", { name: "Conservative" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Aggressive" })).toBeVisible();
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("shows sticky calculate button", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.locator(".fixed.bottom-0").getByRole("button", {
        name: "Calculate schedule",
      }),
    ).toBeVisible();
  });
});
