# Gap 8: Thicken station/regional fall fixtures

**Status:** Planned (not in this slice)  
**Priority:** P3  
**Note:** Less critical after Gap 1 lands climate tier

## Gap
Only **2** station + **3** regional fall dates; **18** zone medians. Thin when climate missing.

## Plan
1. After Gap 1, sample climate `firstFallFrostP50` by zone → refresh `fallFrostDates.json`.
2. Add regional medians for major US regions from climate aggregate.
3. Keep station fixtures for e2e/dev ZIPs only.

## Acceptance
- [ ] Zone table covers all hardiness zones used in fixtures
- [ ] Regional records ≥ 6 with `firstFallFrost`
