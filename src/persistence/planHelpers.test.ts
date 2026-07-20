import { describe, expect, it } from "vitest";
import { getCurrentClimateDataVersion } from "@/climate";
import { buildSchedule } from "@/planning";
import { climateSnapshotForZip, parseVarietiesJson, rowToPlan } from "./planHelpers";

describe("planHelpers", () => {
  it("climateSnapshotForZip returns bundled climate version", () => {
    expect(climateSnapshotForZip("55423")).toBeTruthy();
  });

  it("parseVarietiesJson tolerates missing or junk", () => {
    expect(parseVarietiesJson(null)).toEqual({});
    expect(parseVarietiesJson("")).toEqual({});
    expect(parseVarietiesJson("[]")).toEqual({});
    expect(parseVarietiesJson('{"pepper":"habanero","x":1}')).toEqual({
      pepper: "habanero",
    });
  });

  it("rowToPlan prefers climate_snapshot_id for stale check", async () => {
    const schedule = await buildSchedule({
      zone: "5a",
      zip: "55423",
      crops: ["tomato"],
    });
    const plan = rowToPlan(
      {
        id: "1",
        name: "Bed",
        zip: "55423",
        zone: "5a",
        crops_json: '["tomato"]',
        varieties_json: '{"tomato":"early-girl"}',
        risk_profile: "balanced",
        climate_data_version: getCurrentClimateDataVersion(),
        climate_snapshot_id: "outdated-snapshot",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      schedule,
    );
    expect(plan.climateSnapshotId).toBe("outdated-snapshot");
    expect(plan.climateDataStale).toBe(true);
    expect(plan.ownerId).toBeNull();
    expect(plan.varieties).toEqual({ tomato: "early-girl" });
  });

  it("rowToPlan falls back to climate_data_version when snapshot missing", async () => {
    const schedule = await buildSchedule({
      zone: "5a",
      zip: "55423",
      crops: ["tomato"],
    });
    const plan = rowToPlan(
      {
        id: "1",
        name: "Bed",
        zip: "55423",
        zone: "5a",
        crops_json: '["tomato"]',
        risk_profile: "balanced",
        climate_data_version: null,
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      schedule,
    );
    expect(plan.climateDataVersion).toBeNull();
    expect(plan.climateSnapshotId).toBeNull();
    expect(plan.climateDataStale).toBe(true);
  });
});
