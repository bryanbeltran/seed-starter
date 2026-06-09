import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createSavedPlan,
  deleteSavedPlan,
  getSavedPlan,
  listSavedPlans,
  updateSavedPlan,
} from "./savedPlanService";

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "seedstarter-test-"));
  process.env.SEEDSTARTER_DB_DIR = tempDir;
});

afterEach(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
  delete process.env.SEEDSTARTER_DB_DIR;
});

describe("savedPlanService", () => {
  it("lists empty when no plans exist", async () => {
    expect(await listSavedPlans()).toEqual([]);
  });

  it("creates and lists plans with regenerated schedule", async () => {
    const first = await createSavedPlan({
      name: "Spring bed",
      zip: "55423",
      crops: ["tomato", "lettuce"],
      riskProfile: "balanced",
    });
    const second = await createSavedPlan({
      name: "Second bed",
      zip: "10001",
      crops: ["basil"],
    });

    expect(first.id).toBeTruthy();
    expect(first.schedule.tasks.length).toBeGreaterThan(0);
    expect(second.riskProfile).toBe("balanced");

    const plans = await listSavedPlans();
    expect(plans).toHaveLength(2);
  });

  it("updates and deletes plans", async () => {
    const plan = await createSavedPlan({
      name: "Spring bed",
      zip: "55423",
      crops: ["tomato"],
    });

    const defaulted = await createSavedPlan({
      name: "Default risk",
      zip: "55423",
      crops: ["lettuce"],
    });
    expect(defaulted.riskProfile).toBe("balanced");

    const updated = await updateSavedPlan(plan.id, {
      name: "Renamed bed",
      crops: ["pepper"],
      riskProfile: "aggressive",
    });
    expect(updated?.name).toBe("Renamed bed");
    expect(updated?.crops).toEqual(["pepper"]);

    const zipOnly = await updateSavedPlan(plan.id, { zip: "10001" });
    expect(zipOnly?.zone).toBe("7b");

    const fetched = await getSavedPlan(plan.id);
    expect(fetched?.name).toBe("Renamed bed");

    const deleted = await deleteSavedPlan(plan.id);
    expect(deleted).toBe(true);
    expect(await getSavedPlan(plan.id)).toBeNull();
  });

  it("returns null for missing plan", async () => {
    expect(await getSavedPlan("missing")).toBeNull();
    expect(await updateSavedPlan("missing", { name: "x" })).toBeNull();
    expect(await deleteSavedPlan("missing")).toBe(false);
  });
});
