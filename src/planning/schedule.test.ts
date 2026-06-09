import { describe, expect, it } from "vitest";
import { getCropOrDefault } from "@/planning/cropCatalog";
import { buildSchedule, sowDatesFromSchedule } from "./schedule";

const ref = new Date(2026, 0, 15);

describe("buildSchedule", () => {
  it("produces deterministic indoor sow dates", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["tomato", "lettuce"],
      referenceDate: ref,
    });

    expect(schedule.zone).toBe("5a");
    expect(schedule.lastFrostDate).toEqual(new Date(2026, 2, 28));
    expect(schedule.tasks).toHaveLength(2);

    const tomato = schedule.tasks.find((t) => t.cropId === "tomato");
    expect(tomato).toMatchObject({
      type: "indoor_sow",
      label: "Sow Tomato indoors",
    });
    expect(tomato?.date).toEqual(new Date(2026, 0, 31));
  });

  it("uses default offset for unknown crops", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["mystery"],
      referenceDate: ref,
    });

    expect(getCropOrDefault("mystery").indoorSowOffsetDays).toBe(30);
    expect(schedule.tasks[0].date).toEqual(new Date(2026, 1, 26));
  });

  it("maps to legacy sow date shape", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["carrot"],
      referenceDate: ref,
    });

    expect(sowDatesFromSchedule(schedule)).toEqual([
      { seed: "carrot", date: new Date(2026, 2, 14) },
    ]);
  });
});
