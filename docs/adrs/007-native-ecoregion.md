# ADR 007: Native plants by EPA Level III ecoregion

## Status
Accepted (Phase 5 expand 2026-07-20)

## Context
Users want plants **native to their place** and when to start seeds. Hardiness zone is the wrong key (zone 5a MN ≠ 5a CO). Veg catalog scheduling must stay a separate product surface.

## Decision

1. **Nativity key = EPA Level III ecoregion** (`us_l3code`), not USDA hardiness zone.
2. **ZIP → ecoregion** via ZCTA centroid × EPA L3 polygons, **precomputed** to `data/natives/zip-ecoregion.json`. No runtime geo / polygon bundle.
3. **County nativity evidence = USDA PLANTS plus reviewed BONAP NAPA county maps.** Keep candidate species curated. BONAP bundling permission is confirmed by the project owner. BONAP can affirm only from an approved conversion tied to the current map hash and MapKey, an exact taxonomy match, reviewer confirmation of current status, and county raw category exactly `Native`. Preserve the raw category and map update markers; never infer freshness from page dates or HTTP headers. The continental background, TDC occurrence, and TDC continental nativity are not county evidence. A ZCTA recommendation requires affirmative eligible evidence in every intersecting county unless verified finer evidence covers that exact ZCTA. If eligible finer and county records disagree, exact-ZCTA evidence takes precedence for that ZCTA; keep opposing county records visible in the result and report the conflict. Conflicting finer records leave nativity unestablished.
4. **Timing** = GHCN frost percentiles + curated offsets (NRCS / regional guides). `?riskProfile=` maps like the veg planner (spring: conservative→p90; fall: inverted →p10). Default `balanced` (p50).
5. **Stratification:** `stratificationDays` (days before last frost) or flag-only copy — no invented precision.
6. **Parallel surface:** `/natives` + `GET /api/natives`. Domain in `src/natives/` (framework-free). Do not fold into veg `CropPicker` / `buildSchedule`.
7. **Catalog depth:** L3 **51**, **25** (High Plains), **59** (Northeastern Coastal Zone), **54** (Central Corn Belt Plains) — each ≥15 cited plants. Uncovered ecoregions return honest `catalogCoverage: "none"`.
8. **County overlay:** Census ZCTA→primary county (`data/natives/zip-county.json`) is **context only** — does not redefine nativity. Shown in API/UI beside ecoregion.
9. **Enrichment:** The project owner separately authorizes scraping Lady Bird Johnson NPIN. Its published Data Use Policy allows non-commercial data use with attribution and prohibits commercial use. Exact autocomplete matches and accessible profiles may enrich taxon names, state/province distribution, free-text native distribution, habitat, and horticultural fields. NPIN geography never establishes county or ZIP nativity. Record profile challenges as unavailable and do not bypass them. Image reuse from PLANTS or NPIN requires source-specific terms review.

## Non-goals
- Zone-as-native claims
- Full continental flora dump
- Unreviewed or taxonomy-ambiguous BONAP maps as nativity evidence
- Purchase / affiliate links
- Saved native meadow plans (`?zip=&season=&riskProfile=` deep-link is the bookmark)
- Soil / GDD

## Consequences
- ETL: `etl:natives-ecoregion`, `etl:natives-county`; CI golden exact-id + county presence.
- ADR 004 frost-first preserved; natives reuse frost + risk profiles, don’t expand climate model.
- Attribution required in UI + `docs/data-sources.md`.

## References
- `docs/plans/native-plants-by-zip.md`
- `docs/plans/native-plants-data-sources.md`
- EPA L3: https://www.epa.gov/eco-research/level-iii-and-iv-ecoregions-continental-united-states
- USDA PLANTS: https://plants.usda.gov
- Census ZCTA-county relationship / county gazetteer
