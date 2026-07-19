# Implementation plans

Ordered product bets after catalog ship (2026-07-18).

| Plan | Priority | Depends on |
|------|----------|------------|
| [Fall season](./fall-season.md) | P0 (implemented) | Climate ETL + ADR |
| [Summer season](./summer-season.md) | P1 | Fall shared season plumbing |
| [Variety timing](./variety-timing.md) | P1 parallel | None (catalog done) |

## Fall follow-up gaps

| Gap | Plan | Slice |
|-----|------|-------|
| 1 Nationwide fall climate | [gap-01](./gap-01-nationwide-fall-climate.md) | done on #18 |
| 2 Golden fall ZIPs | [gap-02](./gap-02-golden-fall-zips.md) | done on #18 |
| 3 Fall e2e | [gap-03](./gap-03-fall-e2e.md) | done on #18 |
| 4 PR / plans hygiene | [gap-04](./gap-04-pr-hygiene.md) | done on #18 |
| 5 Catalog fall coverage | [gap-05](./gap-05-catalog-fall-coverage.md) | later |
| 6 Default season heuristic | [gap-06](./gap-06-default-season-heuristic.md) | later (see fix-06 MVP) |
| 7 ADR 006 refresh | [gap-07](./gap-07-adr-006-refresh.md) | done |
| 8 Fall fallback fixtures | [gap-08](./gap-08-fall-fallback-fixtures.md) | later |

## Audit fixes (pre-merge)

From quality audit of #18. Meta-review: [fix-audit.md](./fix-audit.md).

| # | Plan | Severity | Slice |
|---|------|----------|-------|
| 1 | [fix-01 Postgres season](./fix-01-postgres-season.md) | Blocker | A |
| 2 | [fix-02 SQLite season update](./fix-02-sqlite-season-update.md) | Blocker | A |
| 3 | [fix-03 Percentile order](./fix-03-percentile-order.md) | Should-fix | D |
| 4 | [fix-04 Transplant task order](./fix-04-transplant-task-order.md) | Should-fix | C |
| 5 | [fix-05 API fall crop guard](./fix-05-api-fall-crop-guard.md) | Should-fix | B |
| 6 | [fix-06 Default season](./fix-06-default-season.md) | Should-fix | E |
| 7 | [fix-07 Docs sync](./fix-07-docs-sync.md) | Should-fix | E |

**Ship order:** A (01+02) → B → C → D → E.
