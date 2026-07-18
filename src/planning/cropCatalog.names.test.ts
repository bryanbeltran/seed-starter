import { describe, expect, it } from "vitest";
import { getCropName } from "./cropCatalog";

describe("getCropName", () => {
  it("returns display name for known crop", () => {
    expect(getCropName("tomato")).toBe("Tomato");
  });

  it("falls back to id", () => {
    expect(getCropName("unknown")).toBe("unknown");
  });
});
