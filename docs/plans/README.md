# Implementation plans

| Plan | Priority | Status |
|------|----------|--------|
| [Fall season](./fall-season.md) | P0 | Implemented (#18) — **merge first** |
| [FAANG polish](./faang-polish.md) | **Next** | Ordered 1→10 |
| [Variety timing](./variety-timing.md) | Slot 7 | After merge; ∥ default season |
| [Summer season](./summer-season.md) | Defer | Low signal |

## Polish order (summary)

1. Merge #18 → 2. Prod smoke → 3. README eval → 4. Cross-year frost test → 5. Demo GIF → 6. Frost-aware default (+a11y) → 7. Variety DTM → 8. Season share/list → 9. Fall catalog → 10. Fallbacks

**Critical:** do **4 before 6**. Do **7 before 9**.

## Fall gaps / fixes

Gaps 01–04, 07 done. Fixes 01–07 done on #18.  
Remaining: [gap-05](./gap-05-catalog-fall-coverage.md) (#9), [gap-06](./gap-06-default-season-heuristic.md) (#6), [gap-08](./gap-08-fall-fallback-fixtures.md) (#10).
