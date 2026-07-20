# Fix 2: SQLite saved-plan season on update

**Severity:** Blocker (local + any sqlite path)  
**Status:** Implemented  
**Depends on:** Same season contract as fix 1

## Problem
`sqliteSavedPlans.ts` `updateSavedPlan`:
- Does not read `patch.season ?? existing.season`
- Calls `scheduleForPlan` without season
- UPDATE SQL omits `season` column
- Return stub omits `season` → `rowToPlan` defaults spring

Create/load already thread season. Update path false-greens if tests only assert create.

## Plan
1. Match postgres update shape:
   - `const season = patch.season ?? existing.season`
   - `scheduleForPlan(..., season)`
   - UPDATE SET `season = ?`
   - Include `season` in `rowToPlan` stub
2. Fix test in `savedPlanService.test.ts`:
   - create spring → update to fall → **re-fetch via getSavedPlan**
   - assert `season === "fall"` and fall tasks / frost season
3. Do not assert only on update return value without re-get.

## Acceptance
- [x] Update season spring→fall persists in sqlite file
- [x] Re-get after update returns fall schedule
- [x] Existing create/load tests still pass

## Files
`src/persistence/sqliteSavedPlans.ts`, `src/persistence/savedPlanService.test.ts`
