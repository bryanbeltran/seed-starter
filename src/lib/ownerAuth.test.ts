import { afterEach, describe, expect, it } from "vitest";
import {
  OWNER_MAX_AGE_SEC,
  signOwnerToken,
  verifyOwnerToken,
} from "./ownerToken";

const prev = process.env.AUTH_SECRET;

afterEach(() => {
  if (prev === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = prev;
});

describe("ownerToken", () => {
  it("round-trips signed token", () => {
    process.env.AUTH_SECRET = "test-secret-at-least-32-bytes-long!!";
    const token = signOwnerToken("owner-1", Date.now() - 60_000);
    expect(verifyOwnerToken(token)).toBe("owner-1");
  });

  it("rejects tampered sig", () => {
    process.env.AUTH_SECRET = "test-secret-at-least-32-bytes-long!!";
    const token = signOwnerToken("owner-1");
    expect(verifyOwnerToken(token.replace(/\.[^.]+$/, ".deadbeef"))).toBeNull();
  });

  it("rejects expired token", () => {
    process.env.AUTH_SECRET = "test-secret-at-least-32-bytes-long!!";
    const issued = Date.now() - (OWNER_MAX_AGE_SEC + 60) * 1000;
    expect(verifyOwnerToken(signOwnerToken("owner-1", issued))).toBeNull();
  });

  it("rejects legacy two-part token", () => {
    process.env.AUTH_SECRET = "test-secret-at-least-32-bytes-long!!";
    expect(verifyOwnerToken("owner-1.fakesig")).toBeNull();
  });
});
