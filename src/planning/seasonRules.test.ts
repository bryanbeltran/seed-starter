import { describe, expect, it } from "vitest";
import type { CropDefinition } from "./catalogSchema";
import { fallRulesFromCrop, rulesFromCrop, springRulesFromCrop } from "./seasonRules";

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

describe("fallRulesFromCrop", () => {
  it("uses seasons.fall direct-sow days-before-frost", () => {
    const crop: CropDefinition = {
      ...base,
      method: "direct",
      seasons: {
        fall: {
          anchor: "firstFallFrost",
          method: "direct",
          directSowDaysBeforeAnchor: 60,
        },
      },
    };
    expect(fallRulesFromCrop(crop)).toMatchObject({
      method: "direct",
      directSowDaysBeforeFrost: 60,
    });
  });

  it("uses seasons.fall transplant offsets (typically negative)", () => {
    const crop: CropDefinition = {
      ...base,
      seasons: {
        fall: {
          anchor: "firstFallFrost",
          method: "transplant",
          indoorSowOffsetDays: 70,
          hardenOffDaysBeforeTransplant: 7,
          transplantDaysAfterAnchor: -42,
        },
      },
    };
    expect(fallRulesFromCrop(crop)).toMatchObject({
      method: "transplant",
      indoorSowOffsetDays: 70,
      transplantDaysAfterFrost: -42,
    });
  });

  it("falls back to top-level fields when seasons.fall missing", () => {
    expect(fallRulesFromCrop(base)).toMatchObject({
      method: "transplant",
      indoorSowOffsetDays: 40,
      transplantDaysAfterFrost: 7,
    });
  });

  it("ignores seasons.fall with a non-firstFallFrost anchor", () => {
    const crop: CropDefinition = {
      ...base,
      seasons: {
        fall: {
          anchor: "someOtherAnchor",
          method: "direct",
          directSowDaysBeforeAnchor: 30,
        },
      },
    };
    expect(fallRulesFromCrop(crop).method).toBe("transplant");
  });
});

describe("rulesFromCrop", () => {
  it("delegates to spring by default", () => {
    expect(rulesFromCrop(base)).toEqual(springRulesFromCrop(base));
  });

  it("delegates to fall when season is fall", () => {
    expect(rulesFromCrop(base, "fall")).toEqual(fallRulesFromCrop(base));
  });
});
