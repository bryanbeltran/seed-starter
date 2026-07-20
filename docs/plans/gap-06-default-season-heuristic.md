# Gap 6: Frost-aware default season

**Status:** Implemented  
**Priority:** P2  
**Depends on:** Gap 1 (climate fall percentiles)

## Gap
UI defaults Fall when `month >= 7`. Ignores ZIP frost dates / “too late to plant.”

## Plan
1. After location resolve, compute next actionable season from:
   - today, `lastFrostP50`, `firstFallFrostP50`, risk profile
2. Encode flip rules (spring→fall when past last transplant window; fall→spring after first frost / year rollover).
3. Keep manual override.
4. Unit tests for heuristic table.

## Acceptance
- [x] Default matches frost windows for golden ZIPs across sample dates
- [x] Override still works
