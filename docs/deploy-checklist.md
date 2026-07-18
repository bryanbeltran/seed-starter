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
SMOKE_URL=https://seed-starter.vercel.app pnpm run smoke
```

Expect:

- `persistence: "postgres"`
- `auth: "owner-cookie"` when `AUTH_SECRET` set
- `commit` matches `git rev-parse --short HEAD` on `main`
