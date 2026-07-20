import { describe, expect, it } from "vitest";
import { lookupZipEcoregion } from "./lookupEcoregion";
import { resolveNatives } from "./resolveNatives";

describe("lookupZipEcoregion", () => {
  it("maps 55423 to L3 51", () => {
    expect(lookupZipEcoregion("55423")).toEqual({
      id: "51",
      name: "North Central Hardwood Forests",
    });
  });
});

describe("resolveNatives", () => {
  const ref = new Date(2026, 0, 15);

  it("returns curated plants with sow dates for 55423", () => {
    const result = resolveNatives({ zip: "55423", zone: "5a", referenceDate: ref });
    expect(result.catalogCoverage).toBe("full");
    expect(result.ecoregion?.id).toBe("51");
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
});
