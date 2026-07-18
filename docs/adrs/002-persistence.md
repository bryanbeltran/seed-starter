# ADR 002: Persistence — sql.js locally, Postgres on Vercel

## Status
Accepted

## Context
Saved plans need a durable store in production and a zero-ops path for local/CI.

## Decision
- Local + CI: `sql.js` file under `.seedstarter/` (or `SEEDSTARTER_DB_DIR`).
- Production: Neon Postgres when `DATABASE_URL` is set.
- Facade in `savedPlanService` selects backend at import time.

## Consequences
- Same API surface for both backends.
- Prod without `DATABASE_URL` silently uses ephemeral sqlite — unsuitable for multi-instance Vercel. Documented in README deploy checklist.
- Schema evolves via idempotent ALTERs in both runners.
