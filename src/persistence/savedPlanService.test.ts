import fs from "fs";
import os from "os";
import path from "path";
import initSqlJs from "sql.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getCurrentClimateDataVersion } from "@/climate";
import {
  createSavedPlan,
  deleteSavedPlan,
  getSavedPlan,
  listSavedPlans,
  resetDbCacheForTests,
  updateSavedPlan,
} from "./savedPlanService";

let tempDir: string;

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "seedstarter-test-"));
  process.env.SEEDSTARTER_DB_DIR = tempDir;
});

afterEach(() => {
  resetDbCacheForTests();
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
    expect(first.climateDataVersion).toBe(getCurrentClimateDataVersion());
    expect(first.climateSnapshotId).toBeTruthy();
    expect(first.climateDataStale).toBe(false);
    expect(first.scheduleDiff).toBeNull();
    expect(first.ownerId).toBeNull();
    expect(first.season).toBe("spring");
    expect(second.riskProfile).toBe("balanced");

    const plans = await listSavedPlans();
    expect(plans).toHaveLength(2);
  });

  it("persists season on create and update", async () => {
    const plan = await createSavedPlan({
      name: "Fall bed",
      zip: "55423",
      crops: ["carrot"],
      season: "fall",
    });
    expect(plan.season).toBe("fall");
    expect(plan.schedule.season).toBe("fall");
    expect(plan.schedule.tasks.some((t) => t.type === "fall_sow")).toBe(true);

    const reloaded = await getSavedPlan(plan.id);
    expect(reloaded?.season).toBe("fall");
    expect(reloaded?.schedule.season).toBe("fall");
    expect(reloaded?.schedule.tasks.some((t) => t.type === "fall_sow")).toBe(true);

    await updateSavedPlan(plan.id, { season: "spring" });
    const flipped = await getSavedPlan(plan.id);
    expect(flipped?.season).toBe("spring");
    expect(flipped?.schedule.season).toBe("spring");
    expect(flipped?.schedule.tasks.some((t) => t.type === "fall_sow")).toBe(false);

    await updateSavedPlan(plan.id, { season: "fall" });
    const back = await getSavedPlan(plan.id);
    expect(back?.season).toBe("fall");
    expect(back?.schedule.tasks.some((t) => t.type === "fall_sow")).toBe(true);
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

  it("flags stale climate when stored version differs", async () => {
    const plan = await createSavedPlan({
      name: "Spring bed",
      zip: "55423",
      crops: ["tomato"],
    });

    const SQL = await initSqlJs();
    const sqlitePath = path.join(tempDir, "seedstarter.sqlite");
    const db = new SQL.Database(fs.readFileSync(sqlitePath));
    db.run(
      "UPDATE saved_plans SET climate_data_version = ?, climate_snapshot_id = ?, last_frost_date = ? WHERE id = ?",
      ["outdated-2020", "outdated-2020", "2020-01-01T00:00:00.000Z", plan.id],
    );
    fs.writeFileSync(sqlitePath, Buffer.from(db.export()));
    db.close();
    resetDbCacheForTests();

    const reopened = await getSavedPlan(plan.id);
    expect(reopened?.climateDataVersion).toBe("outdated-2020");
    expect(reopened?.climateDataStale).toBe(true);
    expect(reopened?.scheduleDiff?.lastFrostChanged).toBe(true);
    expect(reopened?.schedule.climateDataVersion).toBe(
      getCurrentClimateDataVersion(),
    );
  });

  it("returns null for missing plan", async () => {
    expect(await getSavedPlan("missing")).toBeNull();
    expect(await updateSavedPlan("missing", { name: "x" })).toBeNull();
    expect(await deleteSavedPlan("missing")).toBe(false);
  });
});
