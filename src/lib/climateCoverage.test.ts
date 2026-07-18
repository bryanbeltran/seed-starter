import { describe, expect, it } from "vitest";
import { computeCoverageStats } from "./climateCoverage";

describe("computeCoverageStats", () => {
  it("summarizes nationwide climate confidence", () => {
    const stats = computeCoverageStats();
    expect(stats.manifest.zipCount).toBeGreaterThan(30_000);
    expect(stats.usable).toBeGreaterThan(30_000);
    expect(stats.confidence.high + stats.confidence.medium + stats.confidence.low).toBe(
      stats.usable,
    );
  });
});
