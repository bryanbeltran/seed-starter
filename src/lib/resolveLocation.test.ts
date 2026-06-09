import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveLocation } from "./resolveLocation";
import { ZoneLookupError } from "./zipToZone";

describe("resolveLocation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses offline fixture for known zips", async () => {
    const result = await resolveLocation("55423");
    expect(result.zone).toBe("5a");
    expect(result.source).toBe("fixture");
  });

  it("uses bundled PRISM PHZM table", async () => {
    const result = await resolveLocation("12345");
    expect(result.zone).toBe("6a");
    expect(result.source).toBe("phzm");
  });

  it("falls back to PHZM API for unknown zips", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ zone: "3a" }),
      }),
    );

    const result = await resolveLocation("59999");
    expect(result.zone).toBe("3a");
    expect(result.source).toBe("phzm");
  });

  it("throws when PHZM lookup fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false }),
    );

    await expect(resolveLocation("59999")).rejects.toThrow(ZoneLookupError);
  });

  it("throws when PHZM returns no zone", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    );

    await expect(resolveLocation("59999")).rejects.toThrow(ZoneLookupError);
  });
});
