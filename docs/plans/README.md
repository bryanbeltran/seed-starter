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
| 1 Nationwide fall climate | [gap-01](./gap-01-nationwide-fall-climate.md) | **this PR** |
| 2 Golden fall ZIPs | [gap-02](./gap-02-golden-fall-zips.md) | **this PR** |
| 3 Fall e2e | [gap-03](./gap-03-fall-e2e.md) | **this PR** |
| 4 PR / plans hygiene | [gap-04](./gap-04-pr-hygiene.md) | **this PR** |
| 5 Catalog fall coverage | [gap-05](./gap-05-catalog-fall-coverage.md) | later |
| 6 Default season heuristic | [gap-06](./gap-06-default-season-heuristic.md) | later |
| 7 ADR 006 refresh | [gap-07](./gap-07-adr-006-refresh.md) | bundled w/ 4 |
| 8 Fall fallback fixtures | [gap-08](./gap-08-fall-fallback-fixtures.md) | later |

**Recommend:** finish gaps 1–4 on the fall branch; 5–8 after merge.
