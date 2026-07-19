# Fix 5: Reject fall schedules for crops without seasons.fall

**Severity:** Should-fix  
**Status:** Ready to build  

## Problem
UI filters via `cropSupportsSeason`. API/`buildSchedule` still accepts any crop + `season:"fall"`. Missing fall rules → `fallRulesFromCrop` → `flatRules` (spring top-level offsets) on first-fall-frost anchor → nonsense dates.

## Plan
1. In `buildSchedule` (or `createScheduleFromRequest` after parse):
   - For each selection, if `!cropSupportsSeason(crop, season)` → collect errors
   - Fail request with **400** + clear message listing invalid crop ids
2. Keep spring permissive (`cropSupportsSeason` already returns true for spring).
3. Tests:
   - `buildSchedule` / API schema path: tomato + fall → error
   - lettuce + fall → OK
4. OpenAPI: document error response (brief).
5. Do **not** silently drop crops (explicit fail is clearer than partial schedules).

## Acceptance
- [ ] Fall + tomato → 400
- [ ] Fall + lettuce → 200 with fall tasks
- [ ] Spring + any catalog crop unchanged
- [ ] Unit or route test covers both

## Files
`src/planning/schedule.ts` and/or `src/lib/createScheduleFromRequest.ts`, `src/app/api/schedules/route.ts`, tests, `src/api/openapi.ts`
