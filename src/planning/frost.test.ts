import { describe, expect, it } from "vitest";
import {
  frostDateStringForZone,
  frostPercentileDates,
  lastFrostDateForZone,
  nextFrostDate,
} from "./frost";

describe("nextFrostDate", () => {
  it("returns same-year frost when still ahead", () => {
    const ref = new Date(2026, 0, 1);
    const frost = nextFrostDate(4, 5, ref);
    expect(frost).toEqual(new Date(2026, 3, 5));
  });

  it("rolls to next year when frost has passed", () => {
    const ref = new Date(2026, 5, 8);
    const frost = nextFrostDate(4, 5, ref);
    expect(frost).toEqual(new Date(2027, 3, 5));
  });
});

describe("frostPercentileDates", () => {
  it("keeps p10/p50/p90 in one year when ref is between p10 and p50", () => {
    // After early frost (p10) but before median (p50) — naive nextFrostDate
    // would roll p10 alone into next year.
    const ref = new Date(2026, 3, 10); // Apr 10
    const { p10, p50, p90 } = frostPercentileDates(
      "04-01",
      "04-15",
      "04-30",
      ref,
    );
    expect(p10).toEqual(new Date(2026, 3, 1));
    expect(p50).toEqual(new Date(2026, 3, 15));
    expect(p90).toEqual(new Date(2026, 3, 30));
    expect(p10.getTime()).toBeLessThan(p50.getTime());
    expect(p50.getTime()).toBeLessThan(p90.getTime());
  });

  it("rolls the whole trio when p50 has passed", () => {
    const ref = new Date(2026, 4, 1); // May 1
    const { p10, p50, p90 } = frostPercentileDates(
      "04-01",
      "04-15",
      "04-30",
      ref,
    );
    expect(p10).toEqual(new Date(2027, 3, 1));
    expect(p50).toEqual(new Date(2027, 3, 15));
    expect(p90).toEqual(new Date(2027, 3, 30));
  });

  it("aligns fall percentiles the same way", () => {
    const ref = new Date(2026, 8, 28); // Sep 28, after p10
    const { p10, p50, p90 } = frostPercentileDates(
      "09-25",
      "10-05",
      "10-15",
      ref,
    );
    expect(p10.getFullYear()).toBe(2026);
    expect(p50.getFullYear()).toBe(2026);
    expect(p90.getFullYear()).toBe(2026);
    expect(p10.getTime()).toBeLessThan(p50.getTime());
  });
});

describe("lastFrostDateForZone", () => {
  it("uses zone-specific frost date strings", () => {
    expect(frostDateStringForZone("5a")).toBe("03-28");
    expect(frostDateStringForZone("unknown")).toBe(frostDateStringForZone("4a"));
  });

  it("falls back to zone 4a for unknown zones", () => {
    const ref = new Date(2026, 0, 1);
    const unknown = lastFrostDateForZone("99z", ref);
    const fallback = lastFrostDateForZone("4a", ref);
    expect(unknown).toEqual(fallback);
  });
});
