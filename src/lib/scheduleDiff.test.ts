import { describe, expect, it } from "vitest";
import type { Schedule } from "@/planning";
import { diffSchedules } from "./scheduleDiff";

function stub(lastFrost: string, label: string, date: string): Schedule {
  return {
    zone: "5a",
    zip: "55423",
    season: "spring",
    lastFrostDate: new Date(lastFrost),
    frostSource: "climate",
    frostProvenance: "test",
    riskProfile: "balanced",
    tasks: [
      {
        cropId: "tomato",
        type: "indoor_sow",
        date: new Date(date),
        label,
      },
    ],
  };
}

describe("diffSchedules", () => {
  it("detects frost and task date changes", () => {
    const prev = stub("2026-05-01T00:00:00.000Z", "Sow Tomato", "2026-03-01T00:00:00.000Z");
    const curr = stub("2026-05-10T00:00:00.000Z", "Sow Tomato", "2026-03-10T00:00:00.000Z");
    const d = diffSchedules(prev, curr);
    expect(d.lastFrostChanged).toBe(true);
    expect(d.tasksChanged).toBe(1);
    expect(d.changedLabels).toContain("Sow Tomato");
  });
});
