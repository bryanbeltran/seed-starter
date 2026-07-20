# Polish 02: Prod Fall smoke

**Roadmap slot:** 2  
**Status:** Ready (amended after plan audit)  
**Depends on:** [polish-01](./polish-01-merge-fall-pr.md) merged + prod deploy  
**Blocks:** Demo GIF (slot 5); confidence for default-season work  
**Audit:** [polish-01-03-audit.md](./polish-01-03-audit.md)

## Goal
Prove production serves fall climate + schedules + saved-plan season after #18.

## Gate: deploy caught up

```bash
git fetch origin main
MAIN=$(git rev-parse --short origin/main)
# poll until health.commit matches (deploy lag)
for i in 1 2 3 4 5 6 7 8 9 10; do
  C=$(curl -s https://seed-starter.vercel.app/api/health | jq -r .commit)
  echo "try $i: health=$C main=$MAIN"
  [ "$C" = "$MAIN" ] && break
  sleep 30
done
curl -s https://seed-starter.vercel.app/api/health | jq '{commit, persistence, auth, climate}'
```

Expect: `persistence: "postgres"`, `auth: "owner-cookie"`, `commit` = short SHA of `origin/main`, `climate.zipCount` ~33k.

## Automated baseline

```bash
pnpm run smoke:prod
```

Covers spring tomato @ 55423 → `frostSource: climate` (existing). Fall is **not** in smoke.mjs yet.

## Fall-specific API checks (required)

```bash
BASE=https://seed-starter.vercel.app

# Transplant path — lettuce
curl -sS -X POST "$BASE/api/schedules" \
  -H 'content-type: application/json' \
  -d '{"zip":"55423","seeds":["lettuce"],"riskProfile":"balanced","season":"fall"}' \
  | jq '{season, frostSource, lastFrostDate, tasks: [.tasks[]|.type]}'
# Expect: season=fall, frostSource=climate, types include indoor_sow, harden_off, transplant
# lastFrostDate autumn (ISO date month 09–11)

# Direct path — carrot → fall_sow
curl -sS -X POST "$BASE/api/schedules" \
  -H 'content-type: application/json' \
  -d '{"zip":"55423","seeds":["carrot"],"season":"fall"}' \
  | jq '{season, tasks: [.tasks[]|.type]}'
# Expect: fall_sow present

# Reject warm crop
code=$(curl -sS -o /tmp/fall-reject.json -w '%{http_code}' -X POST "$BASE/api/schedules" \
  -H 'content-type: application/json' \
  -d '{"zip":"55423","seeds":["tomato"],"season":"fall"}')
echo "$code"; cat /tmp/fall-reject.json
# Expect: 400 + "not available for fall"

# Location — field name is still lastFrostP50 (season anchor; spring-era name)
curl -sS "$BASE/api/location?zip=55423&season=fall" | jq .
# Expect: season=fall, frostSource=climate, lastFrostP50 autumn yyyy-MM-dd
```

## Manual UI (required)

1. Hard refresh https://seed-starter.vercel.app  
2. Select **Fall**; Tomato hidden; pick **Lettuce** or **Kale**.  
3. ZIP `55423` → Calculate → **First fall frost** + tasks.  
4. Save `prod-fall-smoke` → reload from sidebar → season stays Fall  
   (owner cookie set automatically when `AUTH_SECRET` present).  
5. Flip **Spring** → Tomato available.

## Acceptance
- [x] health.commit matches `origin/main` (after poll)
- [x] `smoke:prod` green
- [x] Fall lettuce + carrot API checks pass
- [x] Fall + tomato → 400
- [x] Location fall returns autumn anchor in `lastFrostP50`
- [x] UI save/reload keeps Fall

## Severity for handoff
| Failure | Block polish-03? |
|---------|------------------|
| API/climate/persistence wrong | **Yes** — hotfix first |
| UI-only flake / copy | No — file issue; README can proceed |

## If fail
| Symptom | Likely cause |
|---------|----------------|
| commit never matches | Deploy failed — Vercel dashboard |
| persistence ≠ postgres | Neon `DATABASE_URL` |
| frostSource ≠ climate | Old bundle / missing zipClimate fields |
| season spring on reload | Postgres season path regress |
| 500 | Vercel function logs |

## Follow-up (not this plan)
Add fall lettuce (or carrot) case to `scripts/smoke.mjs` so `smoke-prod.yml` covers season forever.
