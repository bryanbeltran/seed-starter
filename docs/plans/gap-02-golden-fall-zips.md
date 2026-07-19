# Gap 2: Golden ZIP fall expectations

**Status:** Done  
**Depends on:** Gap 1 (regen) preferred; can snapshot after regen

## Gap
`data/golden-zips.json` + `check-golden-climate.mjs` only assert spring `lastFrostP50`.

## Plan
1. Extend golden entries with optional `fallP50` (MM-DD).
2. Extend checker: when `fallP50` present, require `firstFallFrostP50` within `toleranceDays`.
3. Populate `fallP50` from regenerated climate (actual values ± document tolerance).
4. Keep spring asserts unchanged.

## Acceptance
- [x] ≥20 golden ZIPs carry `fallP50` (50/50)
- [x] `node scripts/check-golden-climate.mjs` passes spring + fall
