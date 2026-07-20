# Fix 1: Postgres saved-plan season create/load

**Severity:** Blocker  
**Status:** Implemented  
**PR:** #18 follow-up

## Problem
`postgresSavedPlans.ts` never persists or regenerates with `season` on create/load:
- `createSavedPlan` → `scheduleForPlan(..., riskProfile)` omits season; INSERT omits `season`
- `planFromRow` → same omit → always spring schedule on get/list
- `PlanRow` / create return object lack `season`
- Update path already writes season — useless if create never stores fall

Prod uses Neon Postgres → fall save/reload broken in production.

## Plan
1. Extend `PlanRow` with `season?: string`.
2. `createSavedPlan`:
   - `const season = input.season ?? "spring"`
   - `scheduleForPlan(zip, zone, crops, riskProfile, season)`
   - INSERT include `season`
   - Pass `season` into `rowToPlan` input object
3. `planFromRow`:
   - Read `row.season` (default `"spring"`)
   - Pass into `scheduleForPlan` and ensure `rowToPlan` sees it (`planHelpers` already defaults)
4. Mirror sqlite create shape for symmetry.
5. Tests: enable/add postgres test (or shared contract test) that:
   - create with `season: "fall"` + fall crop
   - `getSavedPlan` → `season === "fall"` and tasks include `fall_sow` or fall frost label path
   - Skip if no `DATABASE_URL` (existing pattern)

## Acceptance
- [x] Create fall plan in Postgres → column `season='fall'`
- [x] Get/list regenerates fall schedule (not spring)
- [x] Update still works
- [x] `pnpm run test:postgres` green when `DATABASE_URL` set

## Files
`src/persistence/postgresSavedPlans.ts`, `src/persistence/planHelpers.ts` (if needed), `src/persistence/postgresSavedPlans.test.ts` / `savedPlanService.test.ts`
