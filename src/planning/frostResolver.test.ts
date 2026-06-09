import { describe, expect, it } from "vitest";
import { resolveLastFrost } from "./frostResolver";

const ref = new Date(2026, 0, 15);

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
