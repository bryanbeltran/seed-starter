import { test, expect } from "@playwright/test";

test("calculates schedule from fixture zip", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("ZIP code").fill("55423");
  await page.getByLabel("Tomato").check();
  await page.getByRole("button", { name: "Calculate schedule" }).click();
  await expect(page.getByText("Zone 5A")).toBeVisible();
  await expect(page.getByText("Sow Tomato indoors")).toBeVisible();
  await expect(page.getByRole("button", { name: "Print schedule" })).toBeVisible();
});
