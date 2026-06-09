import { describe, expect, it } from "vitest";
import {
  getCurrentClimateDataVersion,
  isClimateVersionStale,
} from "./fileClimateRepository";

describe("climate version", () => {
  it("returns current data version from zipClimate", () => {
    expect(getCurrentClimateDataVersion()).toMatch(/^(spike|ghcn)-/);
  });

  it("detects stale stored versions", () => {
    expect(isClimateVersionStale("old-version")).toBe(true);
    expect(isClimateVersionStale(getCurrentClimateDataVersion())).toBe(false);
    expect(isClimateVersionStale(null)).toBe(true);
  });
});
