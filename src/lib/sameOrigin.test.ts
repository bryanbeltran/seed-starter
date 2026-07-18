import { afterEach, describe, expect, it } from "vitest";
import { assertSameOrigin } from "./sameOrigin";

const prev = process.env.AUTH_SECRET;

afterEach(() => {
  if (prev === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = prev;
});

describe("assertSameOrigin", () => {
  it("allows GET always", () => {
    process.env.AUTH_SECRET = "secret";
    const req = new Request("http://localhost/api/x", {
      method: "GET",
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(assertSameOrigin(req)).toBe(true);
  });

  it("blocks cross-site POST when auth on", () => {
    process.env.AUTH_SECRET = "secret";
    const req = new Request("http://localhost/api/x", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site", host: "localhost" },
    });
    expect(assertSameOrigin(req)).toBe(false);
  });

  it("allows matching Origin", () => {
    process.env.AUTH_SECRET = "secret";
    const req = new Request("http://localhost/api/x", {
      method: "POST",
      headers: { origin: "http://localhost", host: "localhost" },
    });
    expect(assertSameOrigin(req)).toBe(true);
  });

  it("skips when auth off", () => {
    delete process.env.AUTH_SECRET;
    const req = new Request("http://localhost/api/x", {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(assertSameOrigin(req)).toBe(true);
  });
});
