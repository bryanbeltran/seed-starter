import { describe, expect, it } from "vitest";
import { normalizeZip, zipToZone, ZoneLookupError } from "./zipToZone";

describe("zipToZone", () => {
  it("normalizes zip digits", () => {
    expect(normalizeZip(" 55423 ")).toBe("55423");
  });

  it("throws for invalid zip", () => {
    expect(() => normalizeZip("abc")).toThrow(ZoneLookupError);
  });

  it("delegates to resolveLocation", async () => {
    const zone = await zipToZone("55423");
    expect(zone).toBe("5a");
  });
});
