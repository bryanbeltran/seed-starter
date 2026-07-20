# Gap 5: Expand fall catalog coverage

**Status:** Implemented  
**Priority:** P2

## Gap
Only **26/90** crops had `seasons.fall`. Rest hidden in Fall mode.

## Inclusion rules
1. Cool-season vegetables and herbs that mature before first fall frost or tolerate light frost.
2. Fall-planted overwinter alliums (garlic, onion sets, shallot).
3. Short-cycle greens (cress, microgreens, orach) with sow-before-frost offsets ≈ DTM.
4. **Exclude:** warm solanaceae, cucurbits, corn/beans/soy, heat herbs (basil, rosemary, oregano, etc.), cover crops.
5. Offsets in `FALL_DEFAULTS`: direct ≈ days-to-harvest (+buffer); transplant indoor/harden with negative `transplantDaysAfterFrost`.

## Plan
1. Audit remaining crops for fall suitability (cool herbs, more brassicas, roots).
2. Extend `FALL_DEFAULTS` in `cropDefaults.mjs` with cited offsets.
3. Re-run `patch-fall-seasons.mjs` + `audit-timing.mjs`.
4. Target ~40–50 fall-capable crops before claiming “full fall catalog.”

## Acceptance
- [x] Documented inclusion rules
- [x] Fall crop count ≥ 40 with audit green
