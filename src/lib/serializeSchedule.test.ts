import { describe, expect, it } from "vitest";
import { getFileClimateRepository } from "@/climate";
import { buildSchedule } from "@/planning";
import { serializeSchedule } from "./serializeSchedule";

describe("serializeSchedule", () => {
  it("serializes dates to ISO strings", () => {
    const schedule = buildSchedule({
      zone: "5a",
      zip: "55423",
      crops: ["tomato"],
      referenceDate: new Date(2026, 0, 15),
    });
    const json = serializeSchedule(schedule);
    expect(json.zone).toBe("5a");
    expect(json.tasks[0].date).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(json.sowDates.length).toBeGreaterThan(0);
  });

  it("serializes climate percentiles and data version", () => {
    const schedule = buildSchedule({
      zone: "5a",
      zip: "55423",
      crops: ["tomato"],
      referenceDate: new Date(2026, 0, 15),
      climateRepository: getFileClimateRepository(),
    });
    const json = serializeSchedule(schedule);
    expect(json.lastFrostP50).toMatch(/2026-04-/);
    expect(json.lastFrostP90).toBeTruthy();
    expect(json.climateDataVersion).toMatch(/^(spike|ghcn)-/);
  });
});
