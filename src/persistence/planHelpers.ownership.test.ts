import { describe, expect, it } from "vitest";
import { canReadPlan, canWritePlan } from "./planHelpers";

describe("plan ownership", () => {
  it("open mode reads and writes all", () => {
    expect(canReadPlan("a", null)).toBe(true);
    expect(canWritePlan("a", null)).toBe(true);
    expect(canWritePlan(null, undefined)).toBe(true);
  });

  it("auth mode reads own + legacy unowned", () => {
    expect(canReadPlan("a", "a")).toBe(true);
    expect(canReadPlan(null, "a")).toBe(true);
    expect(canReadPlan("b", "a")).toBe(false);
  });

  it("auth mode blocks orphan write takeover", () => {
    expect(canWritePlan("a", "a")).toBe(true);
    expect(canWritePlan(null, "a")).toBe(false);
    expect(canWritePlan("b", "a")).toBe(false);
  });
});
