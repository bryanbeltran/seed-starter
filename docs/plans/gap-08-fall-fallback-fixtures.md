# Gap 8: Thicken station/regional fall fixtures

**Status:** Implemented  
**Priority:** P3  
**Note:** Less critical after Gap 1 lands climate tier

## Gap
Only **2** station + **3** regional fall dates; **18** zone medians. Thin when climate missing.

## Plan
1. Sample climate `firstFallFrostP50` by zone → refresh `fallFrostDates.json` (zones 3a–9b; keep hand-tuned 10a–11b where samples are sparse).
2. Add regional medians for major US region bands from climate aggregate (exclusive zone partitions).
3. Keep station fixtures for e2e/dev ZIPs; add Denver + Seattle.

## Acceptance
- [x] Zone table covers all hardiness zones used in fixtures
- [x] Regional records ≥ 6 with `firstFallFrost`
