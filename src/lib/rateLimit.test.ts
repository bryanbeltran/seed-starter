import { afterEach, describe, expect, it } from "vitest";
import {
  clientIp,
  clientKey,
  rateLimit,
  resetRateLimitForTests,
} from "./rateLimit";

afterEach(() => {
  resetRateLimitForTests();
});

describe("rateLimit", () => {
  it("allows up to limit then blocks", () => {
    expect(rateLimit("t", 2, 60_000).ok).toBe(true);
    expect(rateLimit("t", 2, 60_000).ok).toBe(true);
    expect(rateLimit("t", 2, 60_000).ok).toBe(false);
  });

  it("prefers x-real-ip over x-forwarded-for", () => {
    const req = new Request("http://localhost/", {
      headers: {
        "x-real-ip": "1.2.3.4",
        "x-forwarded-for": "9.9.9.9, 1.2.3.4",
      },
    });
    expect(clientIp(req)).toBe("1.2.3.4");
    expect(clientKey(req, "sched")).toBe("sched:1.2.3.4");
  });
});
