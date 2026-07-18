import { cookies } from "next/headers";
import {
  OWNER_MAX_AGE_SEC,
  authEnabled,
  signOwnerToken,
  verifyOwnerToken,
} from "./ownerToken";

export const OWNER_COOKIE = "ss_owner";
export {
  OWNER_MAX_AGE_SEC,
  authEnabled,
  signOwnerToken,
  verifyOwnerToken,
} from "./ownerToken";

function cookieSecure(): boolean {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}

export async function getOrCreateOwnerId(): Promise<string | null> {
  if (!authEnabled()) return null;
  const jar = await cookies();
  const existing = jar.get(OWNER_COOKIE)?.value;
  if (existing) {
    const id = verifyOwnerToken(existing);
    if (id) return id;
  }
  const ownerId = crypto.randomUUID();
  jar.set(OWNER_COOKIE, signOwnerToken(ownerId), {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: OWNER_MAX_AGE_SEC,
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
  return verifyOwnerToken(decodeURIComponent(match[1]));
}
