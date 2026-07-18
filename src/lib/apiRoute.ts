import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "./rateLimit";
import { log, newRequestId, withRequestId } from "./observability";
import { assertSameOrigin } from "./sameOrigin";

type Handler = (req: Request, ctx: { requestId: string }) => Promise<Response>;

export function apiRoute(
  name: string,
  handler: Handler,
  options: { limit?: number; windowMs?: number } = {},
) {
  const limit = options.limit ?? 60;
  const windowMs = options.windowMs ?? 60_000;

  return async (req: Request) => {
    const requestId = req.headers.get("x-request-id") || newRequestId();
    const started = Date.now();

    if (!assertSameOrigin(req)) {
      log("warn", "csrf_blocked", { requestId, route: name });
      return NextResponse.json(
        { error: "Cross-origin request blocked." },
        { status: 403, headers: withRequestId(new Headers(), requestId) },
      );
    }

    const rl = rateLimit(clientKey(req, name), limit, windowMs);
    if (!rl.ok) {
      log("warn", "rate_limited", { requestId, route: name });
      return NextResponse.json(
        { error: "Too many requests. Try again shortly." },
        {
          status: 429,
          headers: withRequestId(
            new Headers({
              "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
              "X-RateLimit-Remaining": "0",
            }),
            requestId,
          ),
        },
      );
    }

    try {
      const res = await handler(req, { requestId });
      const headers = withRequestId(res.headers, requestId);
      headers.set("X-RateLimit-Remaining", String(rl.remaining));
      log("info", "request", {
        requestId,
        route: name,
        status: res.status,
        ms: Date.now() - started,
      });
      return new NextResponse(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
      });
    } catch (err) {
      log("error", "request_failed", {
        requestId,
        route: name,
        ms: Date.now() - started,
        error: err instanceof Error ? err.message : "unknown",
      });
      return NextResponse.json(
        { error: "Internal server error.", requestId },
        { status: 500, headers: withRequestId(new Headers(), requestId) },
      );
    }
  };
}
