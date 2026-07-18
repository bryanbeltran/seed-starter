import { createHmac, timingSafeEqual } from "crypto";

export const OWNER_MAX_AGE_SEC = 60 * 60 * 24 * 365;

export function authSecret(): string | undefined {
  return process.env.AUTH_SECRET || undefined;
}

export function authEnabled(): boolean {
  return Boolean(authSecret());
}

/** token = ownerId.issuedAtMs.sig */
export function signOwnerToken(ownerId: string, issuedAtMs = Date.now()): string {
  const secret = authSecret();
  if (!secret) return ownerId;
  const payload = `${ownerId}.${issuedAtMs}`;
  const sig = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export function verifyOwnerToken(token: string): string | null {
  const secret = authSecret();
  if (!secret) return token || null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [ownerId, issuedAtStr, sig] = parts;
  if (!ownerId || !issuedAtStr || !sig) return null;

  const issuedAt = Number(issuedAtStr);
  if (!Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > OWNER_MAX_AGE_SEC * 1000) return null;

  const payload = `${ownerId}.${issuedAtStr}`;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return ownerId;
  } catch {
    return null;
  }
}
