import { describe, expect, it } from "vitest";
import { getFileClimateRepository } from "@/climate";
import { getCropOrDefault } from "@/planning/cropCatalog";
import {
  buildSchedule,
  compareSchedules,
  sowDatesFromSchedule,
} from "./schedule";

const climate = getFileClimateRepository();

const ref = new Date(2026, 0, 15);

describe("buildSchedule", () => {
  it("uses station frost when zip matches fixture", () => {
    const schedule = buildSchedule({
      zone: "5a",
      zip: "55423",
      crops: ["tomato"],
      referenceDate: ref,
    });

    expect(schedule.frostSource).toBe("station");
    expect(schedule.lastFrostDate).toEqual(new Date(2026, 3, 25));
    expect(schedule.tasks.some((t) => t.type === "transplant")).toBe(true);
    expect(schedule.tasks.some((t) => t.type === "harvest")).toBe(true);
  });

  it("uses regional frost without zip", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["tomato"],
      referenceDate: ref,
    });

    expect(schedule.frostSource).toBe("regional");
    expect(schedule.lastFrostDate).toEqual(new Date(2026, 3, 20));
  });

  it("builds harden-off and transplant tasks for transplants", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["kale"],
      referenceDate: ref,
    });
    const harden = schedule.tasks.find((t) => t.type === "harden_off")!;
    const transplant = schedule.tasks.find((t) => t.type === "transplant")!;
    expect(harden.date.getTime()).toBeLessThan(transplant.date.getTime());
  });

  it("produces direct-sow tasks for carrots", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["carrot"],
      referenceDate: ref,
    });

    expect(schedule.tasks.map((t) => t.type)).toEqual(["direct_sow", "harvest"]);
  });

  it("uses default offset for unknown crops", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["mystery"],
      referenceDate: ref,
    });

    expect(getCropOrDefault("mystery").indoorSowOffsetDays).toBe(30);
    expect(schedule.tasks[0].type).toBe("indoor_sow");
  });

  it("maps to legacy sow date shape", () => {
    const schedule = buildSchedule({
      zone: "5a",
      zip: "55423",
      crops: ["carrot"],
      referenceDate: ref,
    });

    expect(sowDatesFromSchedule(schedule)[0].seed).toBe("carrot");
  });

  it("honors crop selections with varieties", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["pepper"],
      cropSelections: [{ cropId: "pepper", varietyId: "habanero" }],
      referenceDate: ref,
    });

    const sow = schedule.tasks.find((t) => t.type === "indoor_sow")!;
    const transplant = schedule.tasks.find((t) => t.type === "transplant")!;
    expect(sow.label).toContain("Habanero");
    expect(transplant.date.getTime()).toBeGreaterThan(sow.date.getTime());
  });

  it("uses climate percentiles when repository is provided", () => {
    const schedule = buildSchedule({
      zone: "5a",
      zip: "55423",
      crops: ["tomato"],
      referenceDate: ref,
      climateRepository: climate,
    });

    expect(schedule.frostSource).toBe("climate");
    expect(schedule.frostPercentiles?.p10!.getTime()).toBeLessThan(
      schedule.frostPercentiles?.p90!.getTime() ?? 0,
    );
    expect(schedule.climateDataVersion).toMatch(/^(spike|ghcn)-/);
  });

  it("transplants lettuce before last frost via seasons.spring", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["lettuce"],
      referenceDate: ref,
    });
    const transplant = schedule.tasks.find((t) => t.type === "transplant")!;
    expect(transplant.date.getTime()).toBeLessThan(schedule.lastFrostDate.getTime());
    expect(
      (schedule.lastFrostDate.getTime() - transplant.date.getTime()) / 86_400_000,
    ).toBe(14);
  });

  it("differentiates crop spring timing in schedules", () => {
    const tomato = buildSchedule({
      zone: "5a",
      crops: ["tomato"],
      referenceDate: ref,
    });
    const broccoli = buildSchedule({
      zone: "5a",
      crops: ["broccoli"],
      referenceDate: ref,
    });
    const frost = tomato.lastFrostDate;
    const tomatoTx = tomato.tasks.find((t) => t.type === "transplant")!;
    const broccoliTx = broccoli.tasks.find((t) => t.type === "transplant")!;
    expect(tomatoTx.date.getTime()).toBeGreaterThanOrEqual(frost.getTime());
    expect(broccoliTx.date.getTime()).toBeLessThan(frost.getTime());
  });

  it("shifts frost date by risk profile", () => {
    const conservative = buildSchedule({
      zone: "7b",
      crops: ["lettuce"],
      riskProfile: "conservative",
      referenceDate: ref,
    });
    const aggressive = buildSchedule({
      zone: "7b",
      crops: ["lettuce"],
      riskProfile: "aggressive",
      referenceDate: ref,
    });

    const cSow = conservative.tasks.find((t) => t.type === "indoor_sow")!;
    const aSow = aggressive.tasks.find((t) => t.type === "indoor_sow")!;
    expect(cSow.date.getTime()).toBeGreaterThan(aSow.date.getTime());
  });
});

describe("compareSchedules", () => {
  it("returns all three risk profiles", () => {
    const compared = compareSchedules({
      zone: "5a",
      crops: ["tomato"],
      referenceDate: ref,
    });

    expect(Object.keys(compared)).toEqual([
      "conservative",
      "balanced",
      "aggressive",
    ]);
  });
});
