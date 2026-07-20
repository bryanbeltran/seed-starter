import { describe, expect, it } from "vitest";
import { lookupZipCounty } from "./lookupCounty";
import { lookupZipEcoregion } from "./lookupEcoregion";
import { resolveNatives } from "./resolveNatives";
import { getFileClimateRepository } from "@/climate";

describe("lookupZipEcoregion", () => {
  it("maps 55423 to L3 51", () => {
    expect(lookupZipEcoregion("55423")).toEqual({
      id: "51",
      name: "North Central Hardwood Forests",
    });
  });
});

describe("lookupZipCounty", () => {
  it("maps 55423 to Hennepin MN", () => {
    expect(lookupZipCounty("55423")).toEqual({
      fips: "27053",
      name: "Hennepin",
      state: "MN",
    });
  });
});

describe("resolveNatives", () => {
  const ref = new Date(2026, 0, 15);
  const climate = getFileClimateRepository();

  it("returns curated plants with sow dates for 55423", () => {
    const result = resolveNatives({ zip: "55423", zone: "5a", referenceDate: ref });
    expect(result.catalogCoverage).toBe("full");
    expect(result.ecoregion?.id).toBe("51");
    expect(result.county?.name).toBe("Hennepin");
    expect(result.riskProfile).toBe("balanced");
    expect(result.plants.length).toBeGreaterThanOrEqual(15);
    expect(result.plants.every((p) => p.sourceUrl && p.tasks.length > 0)).toBe(true);
  });

  it("shifts stratification sow earlier than non-stratifying", () => {
    const result = resolveNatives({ zip: "55423", zone: "5a", referenceDate: ref });
    const echinacea = result.plants.find((p) => p.id === "echinacea-purpurea")!;
    const ratibida = result.plants.find((p) => p.id === "ratibida-pinnata")!;
    expect(ratibida.tasks[0].date.getTime()).toBeLessThan(echinacea.tasks[0].date.getTime());
  });

  it("returns High Plains catalog for 80202", () => {
    const result = resolveNatives({ zip: "80202", zone: "5b", referenceDate: ref });
    expect(result.ecoregion?.id).toBe("25");
    expect(result.catalogCoverage).toBe("full");
    expect(result.plants.length).toBeGreaterThanOrEqual(15);
    expect(result.plants.some((p) => p.id === "bouteloua-gracilis")).toBe(true);
  });

  it("returns Northeastern Coastal Zone for 10001", () => {
    const result = resolveNatives({ zip: "10001", zone: "7b", referenceDate: ref });
    expect(result.ecoregion?.id).toBe("59");
    expect(result.catalogCoverage).toBe("full");
    expect(result.county?.name).toBe("New York");
    expect(result.plants.length).toBeGreaterThanOrEqual(15);
  });

  it("returns Central Corn Belt Plains for 60601", () => {
    const result = resolveNatives({ zip: "60601", zone: "6a", referenceDate: ref });
    expect(result.ecoregion?.id).toBe("54");
    expect(result.catalogCoverage).toBe("full");
    expect(result.plants.some((p) => p.id === "silphium-laciniatum")).toBe(true);
  });

  it("emits fall dormant sow when season is fall", () => {
    const result = resolveNatives({
      zip: "55423",
      zone: "5a",
      season: "fall",
      referenceDate: ref,
    });
    expect(result.season).toBe("fall");
    expect(result.plants.length).toBeGreaterThan(0);
    expect(result.plants.every((p) => p.tasks[0].type === "fall_sow")).toBe(true);
    expect(result.plants.some((p) => /Fall dormant/i.test(p.tasks[0].label))).toBe(true);
  });

  it("applies riskProfile to frost anchor (spring)", () => {
    const conservative = resolveNatives({
      zip: "55423",
      zone: "5a",
      riskProfile: "conservative",
      referenceDate: ref,
      climateLookup: climate,
    });
    const aggressive = resolveNatives({
      zip: "55423",
      zone: "5a",
      riskProfile: "aggressive",
      referenceDate: ref,
      climateLookup: climate,
    });
    expect(conservative.lastFrostDate.getTime()).toBeGreaterThan(
      aggressive.lastFrostDate.getTime(),
    );
    const id = conservative.plants[0].id;
    const cSow = conservative.plants[0].tasks[0].date.getTime();
    const aSow = aggressive.plants.find((p) => p.id === id)!.tasks[0].date.getTime();
    expect(cSow).toBeGreaterThan(aSow);
  });

  it("inverts riskProfile for fall (conservative → earlier)", () => {
    const conservative = resolveNatives({
      zip: "55423",
      zone: "5a",
      season: "fall",
      riskProfile: "conservative",
      referenceDate: ref,
      climateLookup: climate,
    });
    const aggressive = resolveNatives({
      zip: "55423",
      zone: "5a",
      season: "fall",
      riskProfile: "aggressive",
      referenceDate: ref,
      climateLookup: climate,
    });
    expect(conservative.lastFrostDate.getTime()).toBeLessThan(
      aggressive.lastFrostDate.getTime(),
    );
  });

  it("fall list requires fallDormant and uses stratificationDays offset", () => {
    const result = resolveNatives({
      zip: "55423",
      zone: "5a",
      season: "fall",
      referenceDate: ref,
    });
    expect(result.plants.every((p) => p.fallDormant)).toBe(true);
    const ratibida = result.plants.find((p) => p.id === "ratibida-pinnata")!;
    const expected = new Date(result.lastFrostDate);
    expected.setDate(expected.getDate() - 60);
    expect(ratibida.tasks[0].date.toDateString()).toBe(expected.toDateString());
  });
});
