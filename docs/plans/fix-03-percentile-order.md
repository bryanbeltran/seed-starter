# Fix 3: Monotonic frost percentiles (small-n)

**Severity:** Should-fix  
**Status:** Implemented  
**Scope:** ETL math + regen or post-pass clamp

## Problem
`percentilesFromDates` in `scripts/lib/ghcn-zip-climate.mjs`:

```js
pick(p) => sorted[Math.min(n-1, Math.floor(p * (n-1)))]
```

For `n=2`, `floor(0.9*(n-1))=0` → **p90 === p10**, while median can sit later → **p90 < p50**.

Observed after fall regen: **~206** fall + **~202** spring ZIPs with non-monotonic p10/p50/p90. Risk inversion becomes a no-op for those ZIPs.

## Plan
1. Replace estimator with order-statistics that guarantee `p10 ≤ p50 ≤ p90` for MM-DD:
   - Sort by day-of-year (not string sort — `"10-05"` vs `"09-30"` string OK for zero-padded MM-DD; keep DOY sort for safety)
   - Use nearest-rank or linear interpolation; then **enforce** `p10 = min(p10,p50)`, `p90 = max(p90,p50)` (or compute p50 first, clamp)
2. Unit tests in `src/climate/ghcnEtl.test.ts`:
   - `n=1` → all equal
   - `n=2` → p10 ≤ p50 ≤ p90
   - `n=10` smoke
3. Rebuild climate for affected stations OR run a clamp pass over `zipClimate.json` after formula fix:
   - Prefer: fix formula → `--full --write` from existing summaries (no re-fetch if summaries already have fall)
   - Summaries don't store percentiles — only yearly dates → rebuild zipClimate from summaries is enough (`etl:climate --full --write` without refetch)
4. Add CI assertion in `check-climate-drift.mjs` or golden helper: fail if any ZIP has p10 > p50 or p50 > p90 (spring + fall when present).

## Acceptance
- [ ] Unit tests cover small-n monotonicity
- [ ] `zipClimate` fall+spring: 0 non-monotonic rows
- [ ] Golden check still green
- [ ] No full GHCN re-fetch required (rebuild from summaries)

## Files
`scripts/lib/ghcn-zip-climate.mjs`, `src/climate/ghcnEtl.test.ts`, `scripts/check-climate-drift.mjs` (or new check), `data/zipClimate.json` (regen)
