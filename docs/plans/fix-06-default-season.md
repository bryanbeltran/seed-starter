# Fix 6: Safer default season (stop Jul→Fall blind flip)

**Severity:** Should-fix  
**Status:** Implemented  
**Related:** `docs/plans/gap-06-default-season-heuristic.md` (full frost-aware version)

## Problem
`defaultSeasonForDate`: `month >= 6` → `"fall"`. From July onward, first paint is Fall → warm crops hidden. Spring e2e must click `#season-spring`. Surprising for users planning spring beds in midsummer / browsing demo.

## Plan (MVP — this fix)
Ship a **conservative default** without waiting on full frost heuristic:

1. Change default to **always `"spring"`** unless URL/session already has season.
   - OR: default fall only for months **Aug–Oct** (`month >= 7 && month <= 9`) — still crude.
2. **Recommend: always spring** as default until gap-06 frost-aware heuristic ships. SeasonPicker remains one click to Fall.
3. Update `formState.test.ts` expectations.
4. Remove spring-forcing from e2e if default is spring (keep Fall e2e explicit).
5. Document in gap-06 that full ZIP/frost heuristic remains follow-up.

### Not in this fix
Full frost-window flip dates (needs location resolve before default — race with ZIP). Keep that in gap-06.

## Acceptance
- [x] Cold load in July shows Spring selected
- [x] Session/restored fall still wins over default
- [x] Fall e2e still passes
- [x] formState unit tests updated

## Files
`src/components/seed-form/formState.ts`, `formState.test.ts`, `e2e/seed-form.spec.ts` (simplify if possible)
