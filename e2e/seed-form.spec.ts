import { test, expect, type Page } from "@playwright/test";

async function zipAndLockSpring(page: Page) {
  await page.getByLabel("ZIP code").fill("55423");
  // ZIP preview may auto-suggest Fall mid-year; lock Spring for warm-crop tests.
  await page.locator("#season-spring").click();
  await expect(page.locator("#season-spring")).toBeChecked();
}

test("calculates schedule from fixture zip", async ({ page }) => {
  await page.goto("/");
  await zipAndLockSpring(page);
  await page.getByRole("checkbox", { name: "Tomato", exact: true }).click();
  await page.getByRole("button", { name: "Calculate schedule" }).click();
  await expect(page.getByText("Zone 5A", { exact: true })).toBeVisible();
  await expect(page.getByText(/Sow Tomato/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Print schedule" })).toBeVisible();
});

test("saves and reopens a plan", async ({ page }) => {
  const planName = `E2E bed ${Date.now()}`;
  await page.goto("/");
  await zipAndLockSpring(page);
  await page.getByRole("checkbox", { name: "Lettuce", exact: true }).click();
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
  await expect(page.getByRole("status").filter({ hasText: /Loaded plan/ }).first()).toBeVisible();
});

test("compares risk profiles", async ({ page }) => {
  await page.goto("/");
  await zipAndLockSpring(page);
  await page.getByRole("checkbox", { name: "Tomato", exact: true }).click();
  await page.getByLabel("Compare risk profiles").click();
  await page.getByRole("button", { name: "Calculate schedule" }).click();
  await expect(page.getByRole("tab", { name: "Conservative" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Aggressive" })).toBeVisible();
});

test("clicks fruits category on desktop layout", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Fruits", exact: true }).click();
  await expect(page.getByRole("button", { name: "Fruits", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("checkbox", { name: "Tomato", exact: true })).toBeVisible();
  await expect(page.getByRole("checkbox", { name: "Basil", exact: true })).not.toBeVisible();
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
