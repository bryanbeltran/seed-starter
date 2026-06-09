import { describe, expect, it } from "vitest";
import zipClimate from "../../data/zipClimate.json";
import zipZones from "../../data/zipZones.json";
import { resolveLastFrost } from "@/planning/frostResolver";
import { buildSchedule } from "@/planning/schedule";
import { getFileClimateRepository } from "./fileClimateRepository";

const fixtureClimate = Object.fromEntries(
  Object.keys(zipZones)
    .filter((zip) => zip in zipClimate)
    .map((zip) => [zip, zipClimate[zip as keyof typeof zipClimate]]),
);

const ref = new Date(2026, 0, 15);
const climate = getFileClimateRepository();

function parseMmDd(mmdd: string, year = 2026) {
  const [m, d] = mmdd.split("-").map(Number);
  return new Date(year, m - 1, d);
}

describe("golden ZIP climate records", () => {
  for (const [zip, record] of Object.entries(fixtureClimate)) {
    it(`${zip} resolves climate tier with expected p50`, () => {
      const result = resolveLastFrost(
        { zone: zipZones[zip as keyof typeof zipZones], zip, referenceDate: ref },
        climate,
      );
      expect(result.source).toBe("climate");
      expect(result.lastFrostDate).toEqual(parseMmDd(record.lastFrostP50));
      expect(result.dataVersion).toBe(record.dataVersion);
    });
  }

  it("90210 uses climate instead of zone fallback", () => {
    const result = resolveLastFrost(
      { zone: "10b", zip: "90210", referenceDate: ref },
      climate,
    );
    expect(result.source).toBe("climate");
    expect(result.lastFrostDate).toEqual(new Date(2026, 1, 16));
  });

  it("80202 p50 differs from regional northeast bucket", () => {
    const schedule = buildSchedule({
      zone: "6a",
      zip: "80202",
      crops: ["lettuce"],
      referenceDate: ref,
      climateRepository: climate,
    });
    expect(schedule.frostSource).toBe("climate");
    expect(schedule.lastFrostDate).toEqual(new Date(2026, 4, 4));
    expect(schedule.frostPercentiles?.p50).toEqual(new Date(2026, 4, 4));
  });
});
