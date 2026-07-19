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

describe("selectFrostDate (fall)", () => {
  const withPercentiles: FrostResolution = {
    lastFrostDate: new Date(2026, 9, 5),
    lastFrostP10: new Date(2026, 8, 25),
    lastFrostP90: new Date(2026, 9, 15),
    source: "climate",
    provenance: "test",
    season: "fall",
  };

  it("inverts to p10 for conservative in fall (earlier first frost)", () => {
    expect(selectFrostDate(withPercentiles, "conservative")).toEqual(
      withPercentiles.lastFrostP10,
    );
  });

  it("inverts to p90 for aggressive in fall (later first frost)", () => {
    expect(selectFrostDate(withPercentiles, "aggressive")).toEqual(
      withPercentiles.lastFrostP90,
    );
  });

  it("keeps p50 for balanced in fall", () => {
    expect(selectFrostDate(withPercentiles, "balanced")).toEqual(
      withPercentiles.lastFrostDate,
    );
  });

  it("honors explicit season argument overriding resolution.season", () => {
    const springResolution: FrostResolution = {
      ...withPercentiles,
      season: "spring",
    };
    expect(selectFrostDate(springResolution, "conservative", "fall")).toEqual(
      springResolution.lastFrostP10,
    );
  });
});

describe("shiftFrostDate (fall)", () => {
  it("shifts frost earlier for conservative in fall", () => {
    const base = new Date(2026, 9, 15);
    expect(shiftFrostDate(base, "conservative", "fall").getDate()).toBe(8);
  });

  it("shifts frost later for aggressive in fall", () => {
    const base = new Date(2026, 9, 15);
    expect(shiftFrostDate(base, "aggressive", "fall").getDate()).toBe(22);
  });
});
