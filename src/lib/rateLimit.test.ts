import { afterEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimitForTests } from "./rateLimit";

afterEach(() => {
  resetRateLimitForTests();
});

describe("rateLimit", () => {
  it("allows up to limit then blocks", () => {
    expect(rateLimit("t", 2, 60_000).ok).toBe(true);
    expect(rateLimit("t", 2, 60_000).ok).toBe(true);
    expect(rateLimit("t", 2, 60_000).ok).toBe(false);
  });
});
