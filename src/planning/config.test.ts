import { describe, expect, it } from "vitest";
import { cropIds } from "@/planning/cropCatalog";

describe("vitest setup", () => {
  it("resolves path aliases", () => {
    expect(cropIds).toContain("tomato");
  });
});
