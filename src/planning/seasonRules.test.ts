import { describe, expect, it } from "vitest";
import type { CropDefinition } from "./catalogSchema";
import { springRulesFromCrop } from "./seasonRules";

const base: CropDefinition = {
  id: "test",
  name: "Test",
  method: "transplant",
  indoorSowOffsetDays: 40,
  hardenOffDaysBeforeTransplant: 5,
  transplantDaysAfterFrost: 7,
  daysToHarvest: 60,
};

describe("springRulesFromCrop", () => {
  it("prefers seasons.spring transplant offsets over top-level fields", () => {
    const crop: CropDefinition = {
      ...base,
      transplantDaysAfterFrost: 0,
      seasons: {
        spring: {
          anchor: "lastSpringFrost",
          method: "transplant",
          indoorSowOffsetDays: 56,
          hardenOffDaysBeforeTransplant: 7,
          transplantDaysAfterAnchor: -14,
        },
      },
    };
    const rules = springRulesFromCrop(crop);
    expect(rules.method).toBe("transplant");
    expect(rules.indoorSowOffsetDays).toBe(56);
    expect(rules.transplantDaysAfterFrost).toBe(-14);
  });

  it("prefers seasons.spring direct sow timing", () => {
    const crop: CropDefinition = {
      ...base,
      method: "transplant",
      seasons: {
        spring: {
          anchor: "lastSpringFrost",
          method: "direct",
          directSowDaysBeforeAnchor: 21,
        },
      },
    };
    expect(springRulesFromCrop(crop)).toMatchObject({
      method: "direct",
      directSowDaysBeforeFrost: 21,
    });
  });

  it("falls back to top-level fields when spring season missing", () => {
    expect(springRulesFromCrop(base)).toMatchObject({
      method: "transplant",
      indoorSowOffsetDays: 40,
      transplantDaysAfterFrost: 7,
    });
  });

  it("uses catalog lettuce spring transplant before frost", () => {
    const crop: CropDefinition = {
      id: "lettuce",
      name: "Lettuce",
      method: "transplant",
      transplantDaysAfterFrost: 0,
      daysToHarvest: 45,
      seasons: {
        spring: {
          anchor: "lastSpringFrost",
          method: "transplant",
          transplantDaysAfterAnchor: -14,
        },
      },
    };
    expect(springRulesFromCrop(crop).transplantDaysAfterFrost).toBe(-14);
  });
});
