# Polish 02: Prod Fall smoke

**Roadmap slot:** 2  
**Status:** Ready  
**Depends on:** [polish-01](./polish-01-merge-fall-pr.md) merged + Vercel prod deploy finished  
**Blocks:** Demo GIF (slot 5); confidence for default-season work

## Goal
Prove production serves fall climate + schedules + saved-plan season after #18.

## Automated (required)

```bash
git fetch origin main
git checkout main && git pull origin main
# commit on main should match health
curl -s https://seed-starter.vercel.app/api/health | jq '{commit, persistence, auth, climate}'
pnpm run smoke:prod
```

Expect (see `docs/deploy-checklist.md`):
- `persistence: "postgres"`
- `auth: "owner-cookie"`
- `commit` = short SHA of `origin/main`
- `climate.zipCount` ~33k
- Existing smoke: spring `POST /api/schedules` for tomato @ 55423 → `frostSource: climate`

## Fall-specific API checks (required)

```bash
BASE=https://seed-starter.vercel.app

# Fall schedule — lettuce (has seasons.fall)
curl -sS -X POST "$BASE/api/schedules" \
  -H 'content-type: application/json' \
  -d '{"zip":"55423","seeds":["lettuce"],"riskProfile":"balanced","season":"fall"}' \
  | jq '{season, frostSource, lastFrostDate, tasks: [.tasks[]|.type]}'

# Expect: season=fall, frostSource=climate, types include indoor_sow|harden_off|transplant
# lastFrostDate in autumn (month 9–11)

# Reject warm crop in fall
code=$(curl -sS -o /tmp/fall-reject.json -w '%{http_code}' -X POST "$BASE/api/schedules" \
  -H 'content-type: application/json' \
  -d '{"zip":"55423","seeds":["tomato"],"season":"fall"}')
echo "$code"; cat /tmp/fall-reject.json
# Expect: 400 + "not available for fall"

# Location preview fall
curl -sS "$BASE/api/location?zip=55423&season=fall" | jq .
# Expect: first-fall-frost framing / autumn date
```

Optional one-liner to extend `scripts/smoke.mjs` later — **not required** for this plan; manual/curl is enough once.

## Manual UI (required)

1. Open https://seed-starter.vercel.app (hard refresh).
2. Select **Fall**; confirm Tomato hidden; select **Lettuce** or **Kale**.
3. ZIP `55423` → Calculate → see **First fall frost** + sow/transplant tasks.
4. Save plan name e.g. `prod-fall-smoke` → reload from sidebar → season stays Fall.
5. Flip to Spring → Tomato available again.

## Acceptance
- [ ] Health commit matches `main`
- [ ] `smoke:prod` green
- [ ] Fall schedule API returns climate-anchored fall tasks
- [ ] Fall + tomato → 400
- [ ] UI save/reload keeps Fall
- [ ] Note any defect; hotfix before polish-03 if blocker, else file and continue

## If fail
| Symptom | Likely cause |
|---------|----------------|
| commit mismatch | Deploy lag — wait/redeploy |
| persistence ≠ postgres | Neon env |
| fall frostSource ≠ climate | zipClimate not in deploy / old artifact |
| season always spring on reload | postgres season bug resurfaced |
| 500 on fall schedule | runtime error — check Vercel logs |
