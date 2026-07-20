import { describe, expect, it } from "vitest";
import type { FrostClimateLookup } from "./types";
import regionalFrost from "./data/regionalFrost.json";
import fallFrostDates from "./fallFrostDates.json";
import { resolveFirstFallFrost, resolveLastFrost } from "./frostResolver";

const ref = new Date(2026, 0, 15);

describe("fall fallback fixtures", () => {
  it("has ≥6 regional bands with firstFallFrost", () => {
    const withFall = Object.values(regionalFrost).filter((r) => r.firstFallFrost);
    expect(withFall.length).toBeGreaterThanOrEqual(6);
  });

  it("zone fall table covers 3a–11b", () => {
    for (const z of [
      "3a", "3b", "4a", "4b", "5a", "5b", "6a", "6b",
      "7a", "7b", "8a", "8b", "9a", "9b", "10a", "10b", "11a", "11b",
    ]) {
      expect(fallFrostDates[z as keyof typeof fallFrostDates]).toMatch(/^\d{2}-\d{2}$/);
    }
  });
});

describe("resolveLastFrost", () => {
  it("prefers station model for known zips", () => {
    const result = resolveLastFrost({ zone: "5a", zip: "55423", referenceDate: ref });
    expect(result.source).toBe("station");
    expect(result.lastFrostDate).toEqual(new Date(2026, 3, 25));
  });

  it("falls back to regional model", () => {
    const result = resolveLastFrost({ zone: "5a", referenceDate: ref });
    expect(result.source).toBe("regional");
  });

  it("falls back to zone model when no regional match", () => {
    const result = resolveLastFrost({ zone: "10a", referenceDate: ref });
    expect(result.source).toBe("zone");
  });

  it("skips station when zip is not in station list", () => {
    const result = resolveLastFrost({
      zone: "10b",
      zip: "90210",
      referenceDate: ref,
    });
    expect(result.source).toBe("zone");
  });
});

describe("resolveFirstFallFrost", () => {
  it("uses station fall frost for known zips", () => {
    const result = resolveFirstFallFrost({ zone: "5a", zip: "55423", referenceDate: ref });
    expect(result.source).toBe("station");
    expect(result.season).toBe("fall");
    expect(result.lastFrostDate).toEqual(new Date(2026, 9, 5));
  });

  it("falls back to regional model for fall", () => {
    const result = resolveFirstFallFrost({ zone: "5a", referenceDate: ref });
    expect(result.source).toBe("regional");
    expect(result.season).toBe("fall");
  });

  it("falls back to zone model when no regional match", () => {
    const result = resolveFirstFallFrost({ zone: "10a", referenceDate: ref });
    expect(result.source).toBe("zone");
    expect(result.season).toBe("fall");
    expect(result.provenance).toMatch(/first-fall-frost/);
  });

  it("prefers climate fall percentiles when available", () => {
    const lookup: FrostClimateLookup = {
      getByZip: () => ({
        lastFrostP10: "04-01",
        lastFrostP50: "04-15",
        lastFrostP90: "04-30",
        firstFallFrostP10: "09-25",
        firstFallFrostP50: "10-05",
        firstFallFrostP90: "10-15",
        provenance: "test-climate",
        dataVersion: "test-1",
        stationId: "TEST",
        stationName: "Test",
        distanceKm: 5,
      }),
    };
    const result = resolveFirstFallFrost(
      { zone: "5a", zip: "55423", referenceDate: ref },
      lookup,
    );
    expect(result.source).toBe("climate");
    expect(result.lastFrostDate).toEqual(new Date(2026, 9, 5));
    expect(result.lastFrostP10).toEqual(new Date(2026, 8, 25));
    expect(result.lastFrostP90).toEqual(new Date(2026, 9, 15));
  });

  it("keeps climate percentiles in one year when ref splits p10/p50", () => {
    const lookup: FrostClimateLookup = {
      getByZip: () => ({
        lastFrostP10: "04-01",
        lastFrostP50: "04-15",
        lastFrostP90: "04-30",
        firstFallFrostP10: "09-25",
        firstFallFrostP50: "10-05",
        firstFallFrostP90: "10-15",
        provenance: "test-climate",
        dataVersion: "test-1",
        stationId: "TEST",
        stationName: "Test",
        distanceKm: 5,
      }),
    };
    const midSpring = new Date(2026, 3, 10);
    const spring = resolveLastFrost(
      { zone: "5a", zip: "55423", referenceDate: midSpring },
      lookup,
    );
    expect(spring.lastFrostP10!.getFullYear()).toBe(2026);
    expect(spring.lastFrostDate.getFullYear()).toBe(2026);
    expect(spring.lastFrostP90!.getFullYear()).toBe(2026);
    expect(spring.lastFrostP10!.getTime()).toBeLessThan(spring.lastFrostDate.getTime());

    const midFall = new Date(2026, 8, 28);
    const fall = resolveFirstFallFrost(
      { zone: "5a", zip: "55423", referenceDate: midFall },
      lookup,
    );
    expect(fall.lastFrostP10!.getFullYear()).toBe(2026);
    expect(fall.lastFrostDate.getFullYear()).toBe(2026);
    expect(fall.lastFrostP10!.getTime()).toBeLessThan(fall.lastFrostDate.getTime());
  });

  it("falls back through chain when climate lacks fall fields", () => {
    const lookup: FrostClimateLookup = {
      getByZip: () => ({
        lastFrostP10: "04-01",
        lastFrostP50: "04-15",
        lastFrostP90: "04-30",
        provenance: "test-climate",
        dataVersion: "test-1",
        distanceKm: 5,
      }),
    };
    const result = resolveFirstFallFrost(
      { zone: "5a", zip: "55423", referenceDate: ref },
      lookup,
    );
    expect(result.source).toBe("station");
  });
});
