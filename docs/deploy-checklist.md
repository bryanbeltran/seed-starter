# Deploy checklist (P0)

## One-time

1. Vercel project linked to `bryanbeltran/seed-starter` (Git → Production branch `main`)
2. Storage → Neon → sets `DATABASE_URL`
3. Environment variables:
   - `DATABASE_URL` (Neon)
   - `AUTH_SECRET` — `openssl rand -base64 32`
   - optional `SENTRY_DSN`
4. Redeploy production

## Verify after each main merge

```bash
curl -s https://seed-starter.vercel.app/api/health | jq '{commit, persistence, auth, climate}'
pnpm run smoke:prod
```

Expect:

- `persistence: "postgres"`
- `auth: "owner-cookie"` when `AUTH_SECRET` set
- `commit` matches `git rev-parse --short HEAD` on `main`

CI also runs:

- Local smoke after `check` + e2e
- `test:postgres` when `DATABASE_URL` GitHub secret is set
- Strict prod smoke every 6h + after successful `main` CI (`smoke-prod.yml`)
- Weekly climate ETL that opens a PR when data changes (`climate-etl.yml`)
