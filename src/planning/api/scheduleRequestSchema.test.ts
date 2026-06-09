import { describe, expect, it } from "vitest";
import { parseScheduleRequest } from "./scheduleRequestSchema";

describe("parseScheduleRequest", () => {
  it("accepts valid request", () => {
    const result = parseScheduleRequest({
      zip: "55423",
      seeds: ["tomato", "lettuce"],
      riskProfile: "balanced",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.zip).toBe("55423");
      expect(result.data.seeds).toEqual(["tomato", "lettuce"]);
    }
  });

  it("rejects invalid zip", () => {
    const result = parseScheduleRequest({ zip: "abc", seeds: ["tomato"] });
    expect(result.success).toBe(false);
  });

  it("rejects empty seeds", () => {
    const result = parseScheduleRequest({ zip: "55423", seeds: [] });
    expect(result.success).toBe(false);
  });

  it("deduplicates seeds", () => {
    const result = parseScheduleRequest({
      zip: "55423",
      seeds: ["tomato", "tomato"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.seeds).toEqual(["tomato"]);
    }
  });
});
