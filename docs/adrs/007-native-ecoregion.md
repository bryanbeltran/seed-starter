# ADR 007: Native plants by EPA Level III ecoregion

## Status
Accepted (Phase 5 expand 2026-07-20)

## Context
Users want plants **native to their place** and when to start seeds. Hardiness zone is the wrong key (zone 5a MN ≠ 5a CO). Veg catalog scheduling must stay a separate product surface.

## Decision

1. **Nativity key = EPA Level III ecoregion** (`us_l3code`), not USDA hardiness zone.
2. **ZIP → ecoregion** via ZCTA centroid × EPA L3 polygons, **precomputed** to `data/natives/zip-ecoregion.json`. No runtime geo / polygon bundle.
3. **Nativity source of truth = USDA PLANTS** (cite; free for use). Hand-curate species lists. **Do not** redistribute BONAP.
4. **Timing** = GHCN frost percentiles + curated offsets (NRCS / regional guides). `?riskProfile=` maps like the veg planner (spring: conservative→p90; fall: inverted →p10). Default `balanced` (p50).
5. **Stratification:** `stratificationDays` (days before last frost) or flag-only copy — no invented precision.
6. **Parallel surface:** `/natives` + `GET /api/natives`. Domain in `src/natives/` (framework-free). Do not fold into veg `CropPicker` / `buildSchedule`.
7. **Catalog depth:** L3 **51**, **25** (High Plains), **59** (Northeastern Coastal Zone), **54** (Central Corn Belt Plains) — each ≥15 cited plants. Uncovered ecoregions return honest `catalogCoverage: "none"`.
8. **County overlay:** Census ZCTA→primary county (`data/natives/zip-county.json`) is **context only** — does not redefine nativity. Shown in API/UI beside ecoregion.
9. **Enrichment:** Lady Bird Johnson NPIN may be linked; not scraped as SoT. No image bundling from PLANTS/NPIN.

## Non-goals
- Zone-as-native claims
- Full continental flora dump
- BONAP county maps in-repo (county overlay ≠ BONAP nativity)
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
