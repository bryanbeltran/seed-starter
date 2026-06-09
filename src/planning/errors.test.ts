import { describe, expect, it } from "vitest";
import { PlanningError, UnknownCropError } from "./errors";

describe("planning errors", () => {
  it("creates typed errors", () => {
    const err = new UnknownCropError("radish");
    expect(err).toBeInstanceOf(PlanningError);
    expect(err.cropId).toBe("radish");
    expect(err.message).toContain("radish");
  });
});
