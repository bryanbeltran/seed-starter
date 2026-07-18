import { describe, expect, it } from "vitest";
import {
  climateConfidence,
  isClimateOutlier,
  OUTLIER_DISTANCE_KM,
} from "./climateConfidence";

describe("climateConfidence", () => {
  it("classifies distance bands", () => {
    expect(climateConfidence(10)).toBe("high");
    expect(climateConfidence(40)).toBe("medium");
    expect(climateConfidence(100)).toBe("low");
  });

  it("flags outliers beyond threshold", () => {
    expect(isClimateOutlier(OUTLIER_DISTANCE_KM)).toBe(false);
    expect(isClimateOutlier(OUTLIER_DISTANCE_KM + 1)).toBe(true);
  });
});
