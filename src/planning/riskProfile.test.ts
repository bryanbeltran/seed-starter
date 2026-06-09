import { describe, expect, it } from "vitest";
import { shiftFrostDate } from "./riskProfile";

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
