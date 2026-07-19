# Gap 3: Fall season Playwright e2e

**Status:** Done  
**Depends on:** Fall UI (shipped on `cursor/fall-season-3c56`)

## Gap
No e2e covers Season → Fall → schedule → save/load.

## Plan
1. Add `e2e/fall-season.spec.ts` (or cases in `seed-form.spec.ts`):
   - Select Fall season
   - Assert warm crop (Tomato) hidden; cool crop (Lettuce/Kale) available
   - Calculate → see “First fall frost” and fall sow / transplant copy
   - Save plan → reload → season still Fall
2. Use fixture ZIP `55423` (existing e2e pattern).
3. Keep mobile suite untouched.

## Acceptance
- [x] Playwright fall spec green in CI / local
