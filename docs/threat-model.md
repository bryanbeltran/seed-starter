# Threat model (saved plans + API)

## Assets

- Saved plans (ZIP, crops, schedule, owner_id)
- Owner cookie (`ss_owner`) — capability to list/mutate owned plans
- Climate/schedule API (abuse / cost)

## Trust boundaries

| Zone | Trust |
|------|--------|
| Browser UI | Untrusted |
| Next.js API on Vercel | Trusted compute |
| Neon Postgres | Trusted store |
| Share URL `/plans?id=` | Capability URL (UUID) — anyone with link can **read** via SSR |

## Actors

1. **Anonymous / open mode** (`AUTH_SECRET` unset): full CRUD
2. **Cookie owner** (prod): HMAC-signed `ss_owner`
3. **Link holder**: read-only share page
4. **Cross-site attacker**: CSRF, cookie theft, rate-limit bypass

## Controls

| Threat | Mitigation |
|--------|------------|
| Cross-owner plan mutate | `canWritePlan` requires matching `owner_id` (no orphan takeover) |
| Cross-owner API read | `canReadPlan` filters API list/get; share SSR uses id-only read |
| Cookie forgery | HMAC-SHA256 + timing-safe compare |
| Stale stolen cookie | Issued-at embedded; reject after 365d |
| CSRF mutate | SameSite=Lax + Origin/`Sec-Fetch-Site` check when auth on |
| Cookie XSS exfil | `httpOnly`, `Secure` on Vercel/prod, path `/` |
| Rate-limit bypass via spoofed XFF | Prefer `x-real-ip` / `x-vercel-forwarded-for` |
| Bucket map DoS | Cap + expire/clear in-memory buckets |
| Plan ID enumeration | UUIDv4; 404 on miss (no existence oracle beyond share) |

## Explicit non-goals

- Multi-user ACL / org roles
- OAuth / email login
- Distributed rate limit (in-memory per isolate only)
- Encrypting plan payloads at rest beyond Neon defaults

## Residual risk

- Share links are secrets; treat like passwords
- Serverless rate limits are best-effort per instance
- Legacy `owner_id IS NULL` rows remain readable by any authenticated owner until backfilled
