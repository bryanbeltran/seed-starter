# Native plants — data sources

**Status:** Recommended stack (locks ADR 007 inputs)  
**Plan:** [native-plants-by-zip.md](./native-plants-by-zip.md)  
**Date:** 2026-07-19

## Recommendation (short)

| Need | Source | Ship in repo? |
|------|--------|----------------|
| ZIP → ecoregion | Census ZCTA centroids × **EPA Level III** polygons | Precomputed `zip-ecoregion.json` only |
| Is it native here? | **USDA PLANTS** county-or-finer native distribution evidence, matched against every Census county intersection for a ZCTA | `plant-range-evidence.json`; currently empty while live field semantics and endpoint terms await verification |
| Species identity / candidate selection | **USDA PLANTS** profile references plus approved regional curation | Candidate species catalog and per-species profile URLs; catalog membership is not local nativity evidence |
| Seed-start timing | Our **GHCN frost** + **NRCS Plant Guides** / **MN BWSR** establishment guidelines | Offsets in plant JSON; link guides |
| Enrichment (optional) | Lady Bird Johnson NPIN — **link out**, don’t scrape | `sourceUrl` only |

**Reject for bundled data:** BONAP (copyright; written permission required). Garden-center “native” marketing lists. Runtime scrape of wildflower.org.

---

## Layer 1 — Spatial join (Phase 1)

### ZIP / ZCTA centroids
- **What:** lat/lon per ZCTA (already used by climate ETL).
- **Where:** Census gazetteer → `data/zctaCentroids.json` (gitignored; fetch in ETL).
- **License:** US government public data; cite Census.

### Ecoregion polygons
- **What:** EPA **Level III** ecoregions of the conterminous US.
- **Where:** [EPA Level III/IV ecoregions](https://www.epa.gov/eco-research/level-iii-and-iv-ecoregions-continental-united-states) shapefiles (also S3 / EDG mirrors).
- **License:** US public domain; cite EPA NHEERL.
- **ETL:** Point-in-polygon centroid → `us_l3code` / name → `data/natives/zip-ecoregion.json`.
- **Do not** ship polygons or centroids in the app bundle.

### Pilot check
- Confirm `55423` → US L3 **51** (North Central Hardwood Forests) in golden fixture.

---

## Layer 2 — Nativity / species list (Phase 2)

### Primary: USDA PLANTS Database
- **What:** Accepted names, common names, **native vs introduced**, state/county distribution.
- **Where:** [plants.usda.gov](https://plants.usda.gov) (downloads / CloudVault datasets per current USDA docs).
- **License:** Plant information (maps, lists, text) **not copyrighted; free for any use** with citation:

  > USDA, NRCS. [YEAR]. The PLANTS Database (https://plants.usda.gov). National Plant Data Team, Greensboro, NC USA.

- **Images:** Separate rules — **do not** bundle PLANTS photos without per-image check. Text-only v1.
- **How we use it (v1):**
  1. Pick garden-appropriate species known in MN / L3 51 (forbs/grasses first; defer trees if noisy).
  2. Use profile and state-level information for candidate selection only; a plant is not recommended for a ZIP without affirmative county-or-finer PLANTS range evidence matching that ZIP's county FIPS.
  3. Store `id`, names, habit, and `sourceUrl` → PLANTS profile / symbol page in the candidate catalog.
- **Not v1:** Full PLANTS dump → auto ecoregion flora. County→L3 rollup is Phase 5+.

### Rejected / constrained

| Source | Verdict | Why |
|--------|---------|-----|
| **BONAP / NAPA** | **Do not bundle** | Copyright; reproduction needs advance written permission ([bonap.org/citation](http://bonap.org/citation.html)) |
| **Lady Bird Johnson NPIN** | Link-out OK | No clean redistributable dump; scrapers = ToS risk; good as `sourceUrl` enrichment |
| **State DNR / BWSR lists** | **Cite for curation** | Excellent for MN pilot species *selection*; follow each PDF’s use notice; prefer government pubs |
| **NatureServe** | Later / paid | Licensing often restrictive for commercial redistribution |
| **Vendor “native” lists** | Reject | Marketing ≠ range |

### MN pilot curation aids (species *selection*, not sole nativity proof)
- Minnesota BWSR [Native Vegetation Establishment and Enhancement Guidelines](https://bwsr.state.mn.us/) (seeding seasons + mix guidance).
- MN DNR / Prairie reconstruction species lists (cite when used).
- Always dual-check **native** status on USDA PLANTS before shipping a row.

---

## Layer 3 — When to start seeds (timing)

| Input | Source | Role |
|-------|--------|------|
| Last spring frost p50 | Existing `zipClimate` / `resolveFrost` | Calendar anchor (ADR 004) |
| Direct sow / transplant offsets | Curated from **NRCS Plant Guides** + BWSR date tables | `directSowDaysBeforeFrost`, etc. |
| Stratification | NRCS Plant Guide “Seed and Plant Production” / BWSR (fall dormant for many forbs) | `stratificationDays` or fall-sow Phase 5 |
| First fall frost | Existing fall climate | Phase 5 fall-dormant natives |

**Do not** invent offsets from Johnny’s/veg catalog. Native forbs often want **fall dormant sow** — v1 spring path is OK for grasses + non-stratifying forbs; flag stratifiers honestly.

NRCS Plant Guides: search by USDA symbol on PLANTS / plants.usda.gov plant guides (US gov; cite).

---

## v1 data flow

```text
Census centroids × EPA L3  →  zip-ecoregion.json
USDA PLANTS profile refs   →  plants.json (candidate species for selected L3s)
USDA PLANTS county ranges →  plant-range-evidence.json → ZIP recommendations only on local match
NRCS / BWSR timing notes   →  frost offsets + stratificationDays
GHCN frost (existing)      →  concrete dates at request time
```

---

## Attribution (ship in UI + data-sources.md)

- USDA, NRCS — PLANTS Database  
- U.S. EPA — Level III ecoregions  
- U.S. Census Bureau — ZCTA centroids  
- NOAA NCEI — GHCN frost (existing)  
- Per-plant: PLANTS profile URL + optional NRCS Plant Guide / BWSR PDF  

---

## ADR 007 must lock

1. PLANTS as nativity SoT; BONAP not redistributed.  
2. EPA L3 + Census centroids for join.  
3. Timing from frost + NRCS/BWSR — not vendor DTM.  
4. NPIN = link enrichment only.  
5. No PLANTS/BONAP/NPIN image bundling in v1.

---

## Open follow-ups (not blockers for Phase 1)

- Exact PLANTS download path for county×native bulk (site has moved; CloudVault / API variants) — resolve when writing Phase 2 ETL notes.  
- Whether MN county native ∩ L3 51 counties is automated later or stays hand-curated for pilot.  
- Contrast ecoregion species source when Phase 5 starts (still PLANTS + regional NRCS).

## County-level range evidence gate

The ecoregion species JSON is a candidate catalog, not a local nativity assertion. A ZIP recommendation requires an affirmative USDA PLANTS record in `data/natives/plant-range-evidence.json` whose county FIPS matches any Census county intersecting the ZCTA and whose stated resolution is county or finer. Unknown, non-native, state-only, ecoregion-only, or missing evidence never produces a recommendation.

Each range record carries its source citation and URL, release/observation and retrieval dates, license note, geographic scope, spatial resolution, nativity status, and uncertainty. Unknown dates, license details, scope, or uncertainty are represented explicitly as `null`; no date or local claim is inferred from a species profile or L3 catalog entry. `data/natives/native-sources.json` records source coverage and known licensing decisions. The initial range file is intentionally empty because no USDA county-distribution artifact has been ingested.

Run `pnpm run check:native-coverage` offline to report county, L3, catalog, and range-evidence coverage for every lower-48 state. The Census relationship bundle contains 32,604 lower-48 ZCTAs; 32,597 have a named primary county, and 10 ZCTAs touch county FIPS without a matching 2021 Gazetteer name (46113 on nine ZCTAs and 51515 on one). EPA L3 mapping covers 32,537 ZCTAs, leaving 67 without an L3 match. The candidate catalog maps 3,168 ZCTAs, of which 3,165 have resolved primary-county names; 28 states have no catalog coverage, 20 have partial coverage, and none are fully covered. Local USDA county-range evidence currently covers zero catalog-mapped ZCTAs.

### Refresh workflow and source review

The importer uses the official `PlantSearch`, `PlantProfile`, and `PlantProfile/getDownloadDistributionDocumentation` endpoints plus the NRCS PLANTS Counties MapServer. It takes nativity from the layer's published `Symbol` text and leaves numeric `plant_nativity_id` uninterpreted; county FIPS are joined only when a county name identifies one unique U.S. state/county row in the same plant's official Distribution Documentation and that row is in the lower 48. Uniquely identified non-lower-48 rows are excluded; ambiguous names stay unresolved. Profile region status never supplies local evidence.

No live source response was retrieved in this worktree because DNS access to USDA endpoints is unavailable. Therefore the numeric nativity-ID domain, current endpoint reuse terms, and per-record source date remain unverified; `releaseOrObservationDate` is null, retrieval timestamps are recorded, and the bundled evidence file remains empty. The monthly/manual workflow stages and validates a complete snapshot, preserves the checked-out last-good file on failure, and opens a review PR instead of merging data. Review source terms and field semantics before merging.
