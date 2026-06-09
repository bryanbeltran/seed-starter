import { describe, expect, it } from "vitest";
import type { FrostResolution } from "./frostResolver";
import { selectFrostDate, shiftFrostDate } from "./riskProfile";

describe("shiftFrostDate", () => {
  it("shifts frost later for conservative profile", () => {
    const base = new Date(2026, 3, 15);
    const shifted = shiftFrostDate(base, "conservative");
    expect(shifted.getDate()).toBe(22);
  });

  it("shifts frost earlier for aggressive profile", () => {
    const base = new Date(2026, 3, 15);
    const shifted = shiftFrostDate(base, "aggressive");
    expect(shifted.getDate()).toBe(8);
  });
});

describe("selectFrostDate", () => {
  const withPercentiles: FrostResolution = {
    lastFrostDate: new Date(2026, 3, 20),
    lastFrostP10: new Date(2026, 3, 10),
    lastFrostP90: new Date(2026, 4, 1),
    source: "climate",
    provenance: "test",
  };

  it("uses p90 for conservative when percentiles exist", () => {
    expect(selectFrostDate(withPercentiles, "conservative")).toEqual(
      withPercentiles.lastFrostP90,
    );
  });

  it("uses p10 for aggressive when percentiles exist", () => {
    expect(selectFrostDate(withPercentiles, "aggressive")).toEqual(
      withPercentiles.lastFrostP10,
    );
  });

  it("uses p50 for balanced when percentiles exist", () => {
    expect(selectFrostDate(withPercentiles, "balanced")).toEqual(
      withPercentiles.lastFrostDate,
    );
  });

  it("falls back to day shifts without percentiles", () => {
    const base: FrostResolution = {
      lastFrostDate: new Date(2026, 3, 15),
      source: "regional",
      provenance: "test",
    };
    expect(selectFrostDate(base, "conservative").getDate()).toBe(22);
  });
});
