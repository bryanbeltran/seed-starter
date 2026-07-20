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
    expect(schedule.lastFrostDate).toEqual(new Date(2026, 4, 8));
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

  it("shifts harvest when variety daysToHarvest differs from crop", () => {
    const base = buildSchedule({
      zone: "5a",
      crops: ["pepper"],
      referenceDate: ref,
    });
    const variety = buildSchedule({
      zone: "5a",
      crops: ["pepper"],
      cropSelections: [{ cropId: "pepper", varietyId: "habanero" }],
      referenceDate: ref,
    });
    const baseHarvest = base.tasks.find((t) => t.type === "harvest")!;
    const varietyHarvest = variety.tasks.find((t) => t.type === "harvest")!;
    const baseTx = base.tasks.find((t) => t.type === "transplant")!;
    const varietyTx = variety.tasks.find((t) => t.type === "transplant")!;
    expect(varietyTx.date.getTime()).toBe(baseTx.date.getTime());
    const deltaDays =
      (varietyHarvest.date.getTime() - baseHarvest.date.getTime()) /
      (24 * 60 * 60 * 1000);
    expect(deltaDays).toBe(25); // pepper 70 → habanero 95
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

  it("sows pumpkin after last frost", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["pumpkin"],
      referenceDate: ref,
    });
    const sow = schedule.tasks.find((t) => t.type === "direct_sow")!;
    expect(sow.date.getTime()).toBeGreaterThan(schedule.lastFrostDate.getTime());
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

describe("buildSchedule (fall season)", () => {
  it("emits fall_sow for direct crops when season is fall", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["carrot"],
      season: "fall",
      referenceDate: ref,
    });
    const types = schedule.tasks.map((t) => t.type);
    expect(types).toContain("fall_sow");
    expect(types).not.toContain("direct_sow");
    expect(schedule.season).toBe("fall");
  });

  it("keeps indoor_sow for transplant crops in fall", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["lettuce"],
      season: "fall",
      referenceDate: ref,
    });
    const types = schedule.tasks.map((t) => t.type);
    expect(types).toContain("indoor_sow");
    expect(types).toContain("transplant");
    expect(types).not.toContain("fall_sow");
  });

  it("rejects crops without seasons.fall", () => {
    expect(() =>
      buildSchedule({
        zone: "5a",
        crops: ["tomato"],
        season: "fall",
        referenceDate: ref,
      }),
    ).toThrow(/not available for fall/);
  });

  it("builds summer schedule with succession_sow for beans", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["beans"],
      season: "summer",
      referenceDate: ref,
    });
    expect(schedule.season).toBe("summer");
    const types = schedule.tasks.map((t) => t.type);
    expect(types).toContain("direct_sow");
    expect(types).toContain("succession_sow");
    const first = schedule.tasks.find((t) => t.type === "direct_sow")!;
    const second = schedule.tasks.find((t) => t.type === "succession_sow")!;
    expect(second.date.getTime()).toBeGreaterThan(first.date.getTime());
  });

  it("rejects cool crops without seasons.summer", () => {
    expect(() =>
      buildSchedule({
        zone: "5a",
        crops: ["spinach"],
        season: "summer",
        referenceDate: ref,
      }),
    ).toThrow(/not available for summer/);
  });

  it("uses spring frost risk mapping for summer (no invert)", () => {
    const conservative = buildSchedule({
      zone: "5a",
      zip: "55423",
      crops: ["tomato"],
      season: "summer",
      riskProfile: "conservative",
      referenceDate: ref,
    });
    const aggressive = buildSchedule({
      zone: "5a",
      zip: "55423",
      crops: ["tomato"],
      season: "summer",
      riskProfile: "aggressive",
      referenceDate: ref,
    });
    expect(conservative.lastFrostDate.getTime()).toBeGreaterThanOrEqual(
      aggressive.lastFrostDate.getTime(),
    );
  });

  it("orders indoor ≤ harden ≤ transplant for fall lettuce", () => {
    const schedule = buildSchedule({
      zone: "5a",
      zip: "55423",
      crops: ["lettuce"],
      season: "fall",
      referenceDate: ref,
    });
    const indoor = schedule.tasks.find((t) => t.type === "indoor_sow")!;
    const harden = schedule.tasks.find((t) => t.type === "harden_off")!;
    const transplant = schedule.tasks.find((t) => t.type === "transplant")!;
    expect(indoor.date.getTime()).toBeLessThanOrEqual(harden.date.getTime());
    expect(harden.date.getTime()).toBeLessThanOrEqual(transplant.date.getTime());
  });

  it("anchors fall schedule on first-fall-frost fallback", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["carrot"],
      season: "fall",
      referenceDate: ref,
    });
    expect(schedule.lastFrostDate.getMonth()).toBeGreaterThanOrEqual(8);
  });

  it("uses station fall frost for known zip", () => {
    const schedule = buildSchedule({
      zone: "5a",
      zip: "55423",
      crops: ["carrot"],
      season: "fall",
      referenceDate: ref,
    });
    expect(schedule.frostSource).toBe("station");
    expect(schedule.lastFrostDate).toEqual(new Date(2026, 9, 5));
  });

  it("inverts risk profile for fall (conservative → earlier anchor)", () => {
    const conservative = buildSchedule({
      zone: "7b",
      crops: ["carrot"],
      riskProfile: "conservative",
      season: "fall",
      referenceDate: ref,
    });
    const aggressive = buildSchedule({
      zone: "7b",
      crops: ["carrot"],
      riskProfile: "aggressive",
      season: "fall",
      referenceDate: ref,
    });
    expect(conservative.lastFrostDate.getTime()).toBeLessThan(
      aggressive.lastFrostDate.getTime(),
    );
  });

  it("includes fall_sow tasks in legacy sowDates", () => {
    const schedule = buildSchedule({
      zone: "5a",
      crops: ["carrot"],
      season: "fall",
      referenceDate: ref,
    });
    expect(sowDatesFromSchedule(schedule)[0].seed).toBe("carrot");
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
