# Plan: Fall season

**Status:** Implemented (PR #18)  
**Depends on:** Catalog season schema (done)  
**Blocks:** Summer season UI (shared season plumbing)

## Goal

User picks **fall** as the garden season. Schedule anchors on **first fall frost** (p10/p50/p90), uses `seasons.fall` crop rules, emits fall tasks.

## Decisions

1. **MVP = spring + fall only.** Summer shipped separately (see `summer-season.md`).
2. **Anchor = `firstFallFrost`.** Mirror spring GHCN nearest-station model (ADR 003 pattern).
3. **Risk inversion:** conservative → earlier first frost (`p10`); balanced → `p50`; aggressive → later (`p90`).
4. **One plan = one season.** Save/share carries `season`.
5. **ADR 006** multi-season frost.

## Acceptance

- [x] Fall ZIP schedule uses `firstFallFrostP*` when climate present (~99.7% fill)
- [x] Conservative fall frost earlier than aggressive
- [x] Crops without `seasons.fall` hidden in UI; API rejects them
- [x] Saved plan round-trips `season` (sqlite + postgres)
- [x] ADR 006; e2e; golden fallP50
- [x] Pre-merge fixes 01–07 (persistence, percentiles, transplant order, default season, docs)

## Follow-ups

- [gap-05](./gap-05-catalog-fall-coverage.md) expand fall crops
- [gap-06](./gap-06-default-season-heuristic.md) frost-aware default
- [gap-08](./gap-08-fall-fallback-fixtures.md) thicken station/regional fixtures
