# Native plants — data sources

**Status:** Recommended stack (locks ADR 007 inputs)  
**Plan:** [native-plants-by-zip.md](./native-plants-by-zip.md)  
**Date:** 2026-07-19

## Recommendation (short)

| Need | Source | Ship in repo? |
|------|--------|----------------|
| ZIP → ecoregion | Census ZCTA centroids × **EPA Level III** polygons | Precomputed `zip-ecoregion.json` only |
| Is it native here? | **USDA PLANTS** (native status + county/state) → roll up / hand-filter for pilot L3 | Curated plant JSON + citations |
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
  2. Verify **native** in Minnesota (and preferably counties overlapping L3 51) via PLANTS.
  3. Store `id`, names, habit, `sourceUrl` → PLANTS profile / symbol page.
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
USDA PLANTS native check   →  plants.json (hand-curated ≥15 for L3 51)
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
