import { describe, expect, it } from "vitest";
import {
  cropIds,
  getCrop,
  getCropOrDefault,
  listCrops,
  resolveCropRules,
  varietyCount,
  catalogMeta,
} from "./cropCatalog";

describe("cropCatalog", () => {
  it("loads extensive catalog from JSON", () => {
    const meta = catalogMeta();
    expect(meta.version).toBe(1);
    expect(cropIds.length).toBeGreaterThanOrEqual(50);
    expect(listCrops().length).toBe(cropIds.length);
    expect(varietyCount()).toBeGreaterThanOrEqual(2000);
  });

  it("keeps legacy starter crops", () => {
    expect(getCrop("tomato")).toBeDefined();
    expect(getCrop("pepper")).toBeDefined();
    expect(getCrop("lettuce")).toBeDefined();
  });

  it("applies variety overrides when present", () => {
    const tomato = getCrop("tomato");
    const firstVariety = tomato?.varieties && Object.values(tomato.varieties)[0];
    if (!firstVariety) return;
    const rules = resolveCropRules("tomato", firstVariety.id);
    expect(rules.varietyName).toBe(firstVariety.name);
    if (firstVariety.daysToHarvest) {
      expect(rules.daysToHarvest).toBe(firstVariety.daysToHarvest);
    }
  });

  it("returns undefined for unknown crop", () => {
    expect(getCrop("not-a-real-crop-xyz")).toBeUndefined();
  });

  it("ignores unknown variety ids", () => {
    const rules = resolveCropRules("tomato", "unknown");
    expect(rules.varietyName).toBeUndefined();
  });

  it("defaults unknown crop metadata", () => {
    const crop = getCropOrDefault("not-a-real-crop-xyz");
    expect(crop.method).toBe("transplant");
    expect(crop.indoorSowOffsetDays).toBe(30);
  });

  it("every crop has spring season timing", () => {
    for (const crop of listCrops()) {
      expect(crop.seasons?.spring, crop.id).toBeDefined();
      expect(crop.daysToHarvest, crop.id).toBeGreaterThan(0);
    }
  });
});
