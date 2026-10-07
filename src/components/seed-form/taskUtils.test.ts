import { describe, expect, it } from "vitest";
import { daysFromToday, groupTasksByCrop, isPastTask } from "./taskUtils";

describe("taskUtils", () => {
  // Run with TZ=America/Los_Angeles and TZ=Pacific/Kiritimati as well as UTC.
  it.each(["2026-03-08T00:00:00.000Z", "2026-03-08T12:00:00.000Z", "2026-03-08"])(
    "compares the planting day to local today for %s",
    (date) => {
      expect(daysFromToday(date, new Date(2026, 2, 7, 23))).toBe(1);
      expect(daysFromToday(date, new Date(2026, 2, 8, 12))).toBe(0);
      expect(daysFromToday(date, new Date(2026, 2, 9, 0))).toBe(-1);
      expect(isPastTask(date, new Date(2026, 2, 8, 12))).toBe(false);
    },
  );

  it("groups and sorts tasks by crop", () => {
    const groups = groupTasksByCrop([
      { cropId: "tomato", type: "transplant", date: "2026-05-01T12:00:00.000Z", label: "t" },
      { cropId: "tomato", type: "indoor_sow", date: "2026-02-01T12:00:00.000Z", label: "s" },
    ]);
    expect(groups.get("tomato")?.map((t) => t.type)).toEqual(["indoor_sow", "transplant"]);
  });

  it("detects past tasks", () => {
    expect(isPastTask("2020-01-01T12:00:00.000Z")).toBe(true);
  });
});
