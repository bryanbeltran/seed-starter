import { authEnabled } from "./ownerToken";

/** Block cross-site state changes when owner auth is on. */
export function assertSameOrigin(req: Request): boolean {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return true;
  }
  if (!authEnabled()) return true;

  const site = req.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;

  const origin = req.headers.get("origin");
  if (!origin) return true;

  const host = req.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
