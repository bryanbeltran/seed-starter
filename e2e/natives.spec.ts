import { test, expect } from "@playwright/test";

test("natives page shows ecoregion plants for ZIP", async ({ page }) => {
  await page.goto("/natives?zip=55423");

  await expect(page.getByRole("heading", { name: "Native plants" })).toBeVisible();
  await expect(page.getByText("North Central Hardwood Forests")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Purple coneflower", { exact: true })).toBeVisible();
  await expect(page.getByText(/Direct sow Purple coneflower/i)).toBeVisible();
});

test("natives fall dormant filters to fall sow tasks", async ({ page }) => {
  await page.goto("/natives");
  await page.getByLabel("ZIP code").fill("55423");
  await page.locator("#natives-season-fall").click();
  await page.getByRole("button", { name: "Find natives" }).click();

  await expect(page.getByText("North Central Hardwood Forests")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Fall dormant sow/i).first()).toBeVisible();
});

test("natives shows county overlay and risk profile", async ({ page }) => {
  await page.goto("/natives?zip=55423&riskProfile=conservative");

  await expect(page.getByText("Hennepin County, MN")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("conservative", { exact: true }).first()).toBeVisible();
});

test("natives expands to Northeastern Coastal Zone", async ({ page }) => {
  await page.goto("/natives?zip=10001");

  await expect(page.getByText("Northeastern Coastal Zone")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("New England aster", { exact: true })).toBeVisible();
});
