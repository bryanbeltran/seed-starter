import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const OWNER_COOKIE = "ss_owner";

function authSecret(): string | undefined {
  return process.env.AUTH_SECRET || undefined;
}

export function authEnabled(): boolean {
  return Boolean(authSecret());
}

function sign(ownerId: string): string {
  const secret = authSecret();
  if (!secret) return ownerId;
  const sig = createHmac("sha256", secret).update(ownerId).digest("base64url");
  return `${ownerId}.${sig}`;
}

function verify(token: string): string | null {
  const secret = authSecret();
  if (!secret) return token || null;
  const [ownerId, sig] = token.split(".");
  if (!ownerId || !sig) return null;
  const expected = createHmac("sha256", secret).update(ownerId).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return ownerId;
  } catch {
    return null;
  }
}

export async function getOrCreateOwnerId(): Promise<string | null> {
  if (!authEnabled()) return null;
  const jar = await cookies();
  const existing = jar.get(OWNER_COOKIE)?.value;
  if (existing) {
    const id = verify(existing);
    if (id) return id;
  }
  const ownerId = crypto.randomUUID();
  jar.set(OWNER_COOKIE, sign(ownerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return ownerId;
}

export async function requireOwnerId(): Promise<string | null> {
  return getOrCreateOwnerId();
}

export function parseOwnerFromCookieHeader(cookieHeader: string | null): string | null {
  if (!authEnabled() || !cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${OWNER_COOKIE}=([^;]+)`));
  if (!match?.[1]) return null;
  return verify(decodeURIComponent(match[1]));
}
