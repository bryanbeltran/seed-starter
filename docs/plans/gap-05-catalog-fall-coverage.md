# Gap 5: Expand fall catalog coverage

**Status:** Planned (not in this slice)  
**Priority:** P2

## Gap
Only **26/90** crops have `seasons.fall`. Rest hidden in Fall mode.

## Plan
1. Audit remaining crops for fall suitability (cool herbs, more brassicas, cover? no).
2. Extend `FALL_DEFAULTS` in `cropDefaults.mjs` with cited offsets.
3. Re-run `patch-fall-seasons.mjs` + `audit-timing.mjs`.
4. Target ~40–50 fall-capable crops before claiming “full fall catalog.”

## Acceptance
- [ ] Documented inclusion rules
- [ ] Fall crop count ≥ 40 with audit green
