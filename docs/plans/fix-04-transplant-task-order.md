# Fix 4: Transplant task order (harden before indoor sow)

**Severity:** Should-fix  
**Status:** Implemented  

## Problem
`tasksForCrop` (transplant branch) computes:
- `indoorSow = frost - indoorSowOffsetDays`
- `transplant = frost + transplantDaysAfterFrost` (often negative = before frost)
- `harden = transplant - hardenDays`

When `|transplantDaysAfterFrost|` is large and `indoorSowOffsetDays` is small relative to that window, **harden can precede indoor sow**.

Example: fall lettuce (`indoor=30`, `transplant=-28`, `harden=5`) → harden before indoor.

Offsets are horticulturally plausible; **emit order / clamping** is wrong for the timeline.

## Plan
1. After computing the three dates, **enforce order**:
   - `indoorSow ≤ harden ≤ transplant` (and harvest after transplant)
2. Preferred clamp (pick one, document):
   - **A (recommend):** If harden < indoorSow, set `harden = indoorSow` (zero harden window) or push indoor earlier: `indoorSow = min(indoorSow, harden)`
   - **B:** If harden < indoorSow, set `indoorSow = harden - 1 day` (preserve harden window)
3. Apply for both spring and fall (bug is season-agnostic).
4. Unit test: fall lettuce (or synthetic rules) → `indoor ≤ harden ≤ transplant` by date.
5. Optional: audit catalog fall transplant blocks where `indoorSowOffsetDays < |transplantDaysAfterAnchor| + harden` and fix defaults if absurd.

## Acceptance
- [x] No transplant schedule emits harden before indoor sow
- [x] Unit test locks ordering invariant
- [x] Spring schedules unchanged for well-ordered crops (tomato etc.)

## Files
`src/planning/schedule.ts`, `src/planning/schedule.test.ts`, optionally `scripts/catalog/lib/cropDefaults.mjs`
