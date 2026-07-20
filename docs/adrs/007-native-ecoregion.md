# ADR 007: Native plants by EPA Level III ecoregion

## Status
Accepted

## Context
Users want plants **native to their place** and when to start seeds. Hardiness zone is the wrong key (zone 5a MN ≠ 5a CO). Veg catalog scheduling must stay a separate product surface.

## Decision

1. **Nativity key = EPA Level III ecoregion** (`us_l3code`), not USDA hardiness zone.
2. **ZIP → ecoregion** via ZCTA centroid × EPA L3 polygons, **precomputed** to `data/natives/zip-ecoregion.json`. No runtime geo / polygon bundle.
3. **Nativity source of truth = USDA PLANTS** (cite; free for use). Hand-curate v1 species lists. **Do not** redistribute BONAP.
4. **Timing** = existing GHCN last-spring-frost **p50** + curated frost offsets from NRCS Plant Guides / regional establishment guidelines (e.g. MN BWSR). No soil temp / GDD. Optional `?riskProfile=` is a later stretch.
5. **Stratification:** `stratificationDays` (days before last frost) or flag-only copy — no invented precision.
6. **Parallel surface:** `/natives` + `GET /api/natives`. Domain in `src/natives/` (framework-free). Do not fold into veg `CropPicker` / `buildSchedule`.
7. **v1 pilot:** Ecoregion **51** (North Central Hardwood Forests) ≥15 cited plants. Uncovered ecoregions return honest `catalogCoverage: "none"`. Contrast L3 = later expand.
8. **Enrichment:** Lady Bird Johnson NPIN may be linked; not scraped as SoT. No image bundling from PLANTS/NPIN in v1.

## Non-goals
- Zone-as-native claims
- Full continental flora dump
- BONAP county maps in-repo
- Purchase / affiliate links
- Saved native meadow plans (v1 uses `?zip=` deep-link)
- Fall-dormant native path (later; uses first fall frost)

## Consequences
- New ETL (`etl:natives-ecoregion`) and CI golden exact-id check.
- ADR 004 frost-first preserved; natives reuse frost, don’t expand climate model.
- Attribution required in UI + `docs/data-sources.md`.

## References
- `docs/plans/native-plants-by-zip.md`
- `docs/plans/native-plants-data-sources.md`
- EPA L3: https://www.epa.gov/eco-research/level-iii-and-iv-ecoregions-continental-united-states
- USDA PLANTS: https://plants.usda.gov
