import { describe, expect, it } from "vitest";
import {
  cropIds,
  getCrop,
  getCropOrDefault,
  listCrops,
  resolveCropRules,
  varietyCount,
} from "./cropCatalog";

describe("cropCatalog", () => {
  it("lists 11 crops", () => {
    expect(cropIds).toHaveLength(11);
    expect(listCrops()).toHaveLength(11);
  });

  it("has 23 varieties", () => {
    expect(varietyCount()).toBe(23);
  });

  it("applies variety overrides", () => {
    const rules = resolveCropRules("pepper", "habanero");
    expect(rules.indoorSowOffsetDays).toBe(70);
    expect(rules.varietyName).toBe("Habanero");
  });

  it("returns undefined for unknown crop", () => {
    expect(getCrop("radish")).toBeUndefined();
  });

  it("ignores unknown variety ids", () => {
    const rules = resolveCropRules("tomato", "unknown");
    expect(rules.varietyName).toBeUndefined();
    expect(rules.indoorSowOffsetDays).toBe(56);
  });

  it("defaults unknown crop metadata", () => {
    const crop = getCropOrDefault("radish");
    expect(crop.method).toBe("transplant");
    expect(crop.indoorSowOffsetDays).toBe(30);
  });
});
