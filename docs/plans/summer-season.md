# Plan: Summer season

**Status:** Implemented  
**Depends on:** Shared season plumbing from fall plan  
**Does not depend on:** New climate fields (reuse spring frost)

## Goal

User picks **summer**. Schedule uses `seasons.summer` rules for heat-tolerant / succession crops. Emit `succession_sow` where appropriate. No new climate tier.

## Decisions

1. **Anchor = `lastSpringFrost` + later offsets** (not midsummer GDD).
2. **No soil temp / GDD.**
3. **Filter crops** with `seasons.summer` only.
4. **`succession_sow`** when `successionIntervalDays` set (e.g. beans every 14d).
5. **Risk profile:** spring frost mapping (no fall invert).
6. **Default heuristic:** spring → summer → fall (45d lead before first fall frost).

## Acceptance

- [x] Summer schedule builds without new climate columns
- [x] Curated warm-season crops have `seasons.summer` (18)
- [x] `succession_sow` when configured
- [x] No GDD / soil-temp dependency
- [x] `pnpm run check` / e2e / smoke green

## Out of scope

- Full succession planner UI
- Photoperiod / heat-stress models
