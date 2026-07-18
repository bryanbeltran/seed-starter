import { afterEach, describe, expect, it } from "vitest";
import { NextResponse } from "next/server";
import { apiRoute } from "./apiRoute";
import { resetRateLimitForTests } from "./rateLimit";

afterEach(() => {
  resetRateLimitForTests();
});

describe("apiRoute", () => {
  it("adds request id and succeeds", async () => {
    const handler = apiRoute("test-ok", async () => NextResponse.json({ ok: true }));
    const res = await handler(new Request("http://localhost/api/x"));
    expect(res.status).toBe(200);
    expect(res.headers.get("x-request-id")).toBeTruthy();
    expect(await res.json()).toEqual({ ok: true });
  });

  it("rate limits", async () => {
    const handler = apiRoute("test-rl", async () => NextResponse.json({ ok: true }), {
      limit: 1,
    });
    expect((await handler(new Request("http://localhost/a"))).status).toBe(200);
    expect((await handler(new Request("http://localhost/a"))).status).toBe(429);
  });

  it("maps thrown errors to 500", async () => {
    const handler = apiRoute("test-err", async () => {
      throw new Error("boom");
    });
    const res = await handler(new Request("http://localhost/e"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.requestId).toBeTruthy();
  });

  it("blocks cross-site POST when AUTH_SECRET set", async () => {
    const prev = process.env.AUTH_SECRET;
    process.env.AUTH_SECRET = "test-secret";
    try {
      const handler = apiRoute("test-csrf", async () =>
        NextResponse.json({ ok: true }),
      );
      const res = await handler(
        new Request("http://localhost/api/x", {
          method: "POST",
          headers: { "sec-fetch-site": "cross-site", host: "localhost" },
        }),
      );
      expect(res.status).toBe(403);
    } finally {
      if (prev === undefined) delete process.env.AUTH_SECRET;
      else process.env.AUTH_SECRET = prev;
    }
  });
});
