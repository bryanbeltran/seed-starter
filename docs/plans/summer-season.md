# Plan: Summer season

**Status:** Design ready; build after fall MVP  
**Depends on:** Shared season plumbing from fall plan  
**Does not depend on:** New climate fields (reuse spring frost)

## Goal

User picks **summer**. Schedule uses `seasons.summer` rules for heat-tolerant / succession crops. Emit `succession_sow` where appropriate. No new climate tier.

## Current gaps

| Layer | Today |
|-------|--------|
| Catalog | `seasons.summer` schema exists; **0/90** populated |
| Climate | No summer-specific signal (by design) |
| Scheduler | No summer path; `succession_sow` never emitted |
| ADR 004 | Multi-year succession UI = non-goal (single succession events OK) |

## Decisions

1. **Ship after fall** so season picker / API / DB land once.
2. **Anchor = `lastSpringFrost` + later offsets** for v1 (not midsummer GDD).
   - Example: `directSowDaysBeforeAnchor: -60` = ~60 days after last frost.
   - Alternative later: calendar DOY anchor — only if offsets prove awkward.
3. **No soil temp / GDD** unless a new ADR chooses them as summer anchor.
4. **Filter crops** with `seasons.summer` only; do not invent defaults for cool crops.
5. **`succession_sow`** = optional second sow from crop rule (e.g. beans every N days) — one or few events, not a succession optimizer UI.

## Build order

### 1. Shared plumbing (prefer done in fall PR)
- `season: "spring" | "summer" | "fall"` on request / form / saved plans
- `resolveCropRules(..., season)`
- Crop picker filter by season presence

### 2. Anchor + rules design
- Document summer anchors in ADR 006 (or fall ADR amendment)
- Allowed v1: `anchor: "lastSpringFrost"` with large positive-after offsets
- Reject inventing fake climate percentiles for “midsummer”

### 3. Catalog
- Curate `seasons.summer` for: beans, squash, corn, okra, basil, succession greens, etc.
- Helper `summerSeason()` in `cropDefaults.mjs`
- Optional `successionIntervalDays` — **only if** scheduler needs it; else encode second sow as explicit offset fields or skip succession v1

### 4. Scheduler
- `summerRulesFromCrop` (same shape as spring; same frost resolver)
- Emit `succession_sow` when crop declares a second sow offset
- Harvest from summer sow/transplant + `daysToHarvest`
- Risk profile: same spring frost percentiles (no inversion)

### 5. UI
- Season control already present from fall
- Default-season heuristic: spring → summer → fall flip dates (open; design in fall UI)
- `TaskTimeline` icon for `succession_sow`
- Copy: clarify summer still uses last-spring-frost confidence

### 6. Tests
- Summer rules relative to last frost
- Succession task ordering
- Filter hides crops without summer rules
- E2E: summer plan save/load

## Acceptance

- [ ] Summer schedule builds without new climate columns
- [ ] At least a curated set of warm-season crops have `seasons.summer`
- [ ] `succession_sow` appears when configured (or explicitly deferred with ADR note)
- [ ] No GDD / soil-temp dependency
- [ ] `pnpm run check` green

## Out of scope

- Fall climate / first-fall-frost (separate plan)
- Full succession planner UI
- Photoperiod / heat-stress models

## Open questions

1. Flip dates for default season heuristic (shared with fall).
2. Succession v1: emit `succession_sow` now, or fall-only MVP then add?
3. Risk profile meaning in summer — keep spring frost mapping (recommend yes).

## Key files

Same season surfaces as fall plan, plus `data/catalog/crops.json` summer blocks, `src/planning/schedule.ts` succession emit, `TaskTimeline.tsx`.
