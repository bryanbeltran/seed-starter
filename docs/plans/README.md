# Implementation plans

| Plan | Priority | Status |
|------|----------|--------|
| [Fall season](./fall-season.md) | P0 | Implemented (#18) |
| [FAANG polish](./faang-polish.md) | Done (slots 1–10) | Complete |
| [Variety timing](./variety-timing.md) | Slot 7 | Implemented |
| [Native plants by ZIP](./native-plants-by-zip.md) | Done | Merged (#26) — [audit](./native-plants-plan-audit.md) · [impl log](./native-plants-impl-audit.md) |
| [Summer season](./summer-season.md) | Defer | Low signal |

## Polish order (summary)

1. Merge #18 → 2. Prod smoke → 3. README eval → 4. Cross-year frost test → 5. Demo GIF → 6. Frost-aware default (+a11y) → 7. Variety DTM → 8. Season share/list → 9. Fall catalog → 10. Fallbacks

**Critical:** do **4 before 6**. Do **7 before 9**.

### Top 3 — detailed plans

| # | Plan |
|---|------|
| 1 | [polish-01-merge-fall-pr.md](./polish-01-merge-fall-pr.md) |
| 2 | [polish-02-prod-fall-smoke.md](./polish-02-prod-fall-smoke.md) |
| 3 | [polish-03-readme-eval.md](./polish-03-readme-eval.md) |

Plan audit: [polish-01-03-audit.md](./polish-01-03-audit.md) (amendments folded into 01–03).

## Fall gaps / fixes

Gaps 01–04, 07 done. Fixes 01–07 done on #18.  
Gaps: [gap-05](./gap-05-catalog-fall-coverage.md) (#9), [gap-06](./gap-06-default-season-heuristic.md) (#6), [gap-08](./gap-08-fall-fallback-fixtures.md) (#10) — implemented.

Natives: [native plants by ZIP](./native-plants-by-zip.md) ([audit](./native-plants-plan-audit.md); [data sources](./native-plants-data-sources.md); ADR 007).
