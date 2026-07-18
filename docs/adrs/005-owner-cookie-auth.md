# ADR 005: Optional owner-cookie auth for saved plans

## Status
Accepted

## Context
Shareable plan IDs without ownership are a demo risk. Full OAuth is heavy for local/CI.

## Decision
- When `AUTH_SECRET` is unset (default): open access (local + CI e2e).
- When set: HMAC-signed `ss_owner` httpOnly cookie; plans store `owner_id`; list/get/update/delete filter by owner.
- Plans without `owner_id` remain readable by any authenticated owner (migration safety).

## Consequences
- Production can enable ownership without Clerk/Auth0.
- Share links still work for the owner’s browser; not a multi-user ACL.
- Upgrade path: replace cookie with OIDC later without changing plan schema much.
