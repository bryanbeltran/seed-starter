import { describe, expect, it } from "vitest";
import {
  frostDateStringForZone,
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

describe("lastFrostDateForZone", () => {
  it("uses zone-specific frost date strings", () => {
    expect(frostDateStringForZone("5a")).toBe("03-28");
  });

  it("falls back to zone 4a for unknown zones", () => {
    const ref = new Date(2026, 0, 1);
    const unknown = lastFrostDateForZone("99z", ref);
    const fallback = lastFrostDateForZone("4a", ref);
    expect(unknown).toEqual(fallback);
  });
});
