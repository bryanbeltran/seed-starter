# ADR 005: Optional owner-cookie auth for saved plans

## Status
Accepted

## Context
Shareable plan IDs without ownership are a demo risk. Full OAuth is heavy for local/CI.

## Decision
- When `AUTH_SECRET` is unset (default): open access (local + CI e2e).
- When set: HMAC-signed `ss_owner` httpOnly cookie (`ownerId.issuedAt.sig`); plans store `owner_id`.
- Reads: own plans + legacy `owner_id IS NULL`. Writes: matching `owner_id` only (no orphan takeover).
- Share page `/plans?id=` is a capability URL (SSR read by id, no cookie). See [threat-model.md](../threat-model.md).

## Consequences
- Production can enable ownership without Clerk/Auth0.
- Share links work cross-browser for read; mutate still owner-scoped.
- Upgrade path: replace cookie with OIDC later without changing plan schema much.
