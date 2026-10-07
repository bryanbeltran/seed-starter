# Native plants — data sources

**Status:** Recommended stack (locks ADR 007 inputs)  
**Plan:** [native-plants-by-zip.md](./native-plants-by-zip.md)  
**Date:** 2026-07-19

## Recommendation (short)

| Need | Source | Ship in repo? |
|------|--------|----------------|
| ZIP → ecoregion | Census ZCTA centroids × **EPA Level III** polygons | Precomputed `zip-ecoregion.json` only |
| Is it native here? | Eligible **USDA PLANTS** county-or-finer evidence and approved BONAP county-map conversions; every Census county intersection for a ZCTA must have affirmative evidence | `plant-range-evidence.json`; initially empty. BONAP requires current-hash map review and exact taxonomy. NPIN never provides nativity claims |
| Species identity / candidate selection | **USDA PLANTS** profile references plus approved regional curation | Candidate species catalog and per-species profile URLs; catalog membership is not local nativity evidence |
| Seed-start timing | Our **GHCN frost** + **NRCS Plant Guides** / **MN BWSR** establishment guidelines | Offsets in plant JSON; link guides |
| Enrichment (optional) | Lady Bird Johnson NPIN — owner separately authorizes scraping; use ordinary requests to official routes | Exact autocomplete crosswalk plus accessible profile fields; a profile challenge is recorded as unavailable without bypass |

**Owner-authorized sources:** The project owner confirms permission to bundle BONAP and separately to scrape NPIN. BONAP's citation page requires advance written permission, which the owner confirms has been obtained. NPIN's published policy permits non-commercial data use with attribution and prohibits commercial use; the owner separately confirms permission for this project. These permissions are recorded separately from source terms. BONAP may supply county nativity only through an approved, exact-taxon map conversion. NPIN remains crosswalk and enrichment only. Garden-center “native” marketing lists remain unsuitable evidence.

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
  2. Use profile and state-level information for candidate selection only; a plant is not recommended for a ZIP without eligible affirmative county-or-finer nativity evidence for every intersecting county.
  3. Store `id`, names, habit, and `sourceUrl` → PLANTS profile / symbol page in the candidate catalog.
- **Not v1:** Full PLANTS dump → auto ecoregion flora. County→L3 rollup is Phase 5+.

### Source choices and constraints

| Source | Verdict | Why |
|--------|---------|-----|
| **BONAP / NAPA** | Owner confirms the required advance written permission for bundling; source adapter captures linked county maps and uses TDC for identity/presence | The current [NAPA Echinacea route](https://bonap.net/Napa/TaxonMaps/Genus/County/Echinacea) links PNGs; discover taxon URLs from live pages. [TDC FullTaxonList](https://bonap.net/TDC/Query/FullTaxonList) is an approximately 1.4 MB UTF-8 TSV cited 2014, with no stable ID. POST [SpeciesList](https://bonap.net/TDC/Query/SpeciesList) filters by county FIPS; POST [TaxonDetails](https://bonap.net/TDC/Query/TaxonDetails) uses BONAP-scoped `Id` values and includes county occurrence maps. These are identity/presence only. The [MapKey](http://bonap.org/MapKey.html) county categories are `Native`, `Native Historic`, `Adventive`, and `Exotic`; preserve raw values including `rare` or unrecognized values. State background is continental nativity only. Only an approved exact-taxon map conversion with current-status confirmation and raw county `Native` may affirm. Each review ties county FIPS/categories to the map SHA-256 and MapKey. Sample generation date, response headers, and page dates are separate markers; do not infer freshness from headers or page dates. |
| **Lady Bird Johnson NPIN** | Owner separately authorizes scraping; published data terms are recorded; exact autocomplete matches may be enriched from accessible profiles | The [WordPress page API](https://www.wildflower.org/wp-json/wp/v2/pages?slug=plants-main) exposes [`/plants/autocomplete-data.php?q=...`](https://www.wildflower.org/plants/autocomplete-data.php?q=...) with common name, scientific name, genus, and ID only. The accessible [profile route](https://www.wildflower.org/plants/result.php?id_plant=ECAN2) exposes Distribution, Native Distribution, Native Habitat, and horticultural fields. The [Data Use Policy](https://www.wildflower.org/plants-main/image-use-policy) allows non-commercial attributed data use; the owner separately confirms permission. These fields are enrichment, not county/ZIP nativity. Record challenges as unavailable and do not bypass them. |
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
USDA county ranges         →  plant-range-evidence.json
BONAP TDC                  →  native-source-ingestion.json (identity/presence only)
NAPA map PNG + reviewed FIPS/category conversion → plant-range-evidence.json
NPIN autocomplete/profile → native-source-ingestion.json (crosswalk/enrichment only)
Every county intersection → ZIP recommendation only with affirmative claims for all
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

1. USDA PLANTS and approved BONAP county-map conversions may support nativity. A BONAP record requires a current-hash map review, exact taxonomy, MapKey-linked raw category, and reviewer confirmation of current status.
2. EPA L3 + Census centroids for join.  
3. Timing from frost + NRCS/BWSR — not vendor DTM.  
4. NPIN scraping is separately owner-authorized under the recorded non-commercial, attribution terms; use exact autocomplete matches and accessible profiles for enrichment only. State/province and free-text ranges never establish county nativity; do not bypass profile challenges.
5. Only a raw BONAP county category exactly `Native`, with matching taxonomy, can map to affirmative nativity. Preserve all other raw categories; Native Historic, Adventive, Exotic, `rare`, unresolved, and missing categories do not affirm.

---

## Open follow-ups (not blockers for Phase 1)

- Exact PLANTS download path for county×native bulk (site has moved; CloudVault / API variants) — resolve when writing Phase 2 ETL notes.  
- Whether MN county native ∩ L3 51 counties is automated later or stays hand-curated for pilot.  
- Contrast ecoregion species source when Phase 5 starts (still PLANTS + regional NRCS).

## County-level range evidence gate

The ecoregion species JSON is a candidate catalog, not a local nativity assertion. A ZIP recommendation requires eligible affirmative evidence for every Census county intersection in `data/natives/plant-range-evidence.json`, unless verified finer evidence directly covers that exact ZCTA. When eligible finer and county claims disagree, the exact-ZCTA claim takes precedence because it has narrower spatial scope; the response keeps the opposing county records in `rangeEvidenceConflicts` and reports the conflict count. Conflicting finer claims do not establish nativity. Evidence from one county cannot cover another; an unresolved or missing intersection leaves whole-ZIP nativity unestablished without verified finer coverage. USDA keeps its official-domain/citation rules. BONAP additionally requires a county PNG URL, matching SHA-256 review, the MapKey URL, exact taxonomy, approved conversion, and current-status confirmation. Only raw `Native` may be affirmative. TDC occurrence and continental nativity are non-nativity data. NPIN data is never admitted by the range-evidence claim gate.

Each range record carries source citation/URL, release or observation date, retrieval time, license note, geography, resolution, nativity, and uncertainty. BONAP records also carry raw map category, SHA-256, ETag, Last-Modified, map generation date, taxonomy decision, review status, and reviewer note. A generation date read from the image is distinct from HTTP and page markers; unavailable dates stay null. NPIN profile fields are kept in `native-source-ingestion.json` with `nativityResolution: none`. The baseline measured 2026-10-01 is 32,604 ZCTAs with county intersections, 32,537 with ecoregion mapping, 3,168 with catalog entries, and zero bundled range-evidence records. The subsequent 2026-10-07 snapshot maps all 32,604 ZCTAs to candidate catalogs and carries 181,049 range-evidence records: 108,646 USDA claims, 66,262 reviewed BONAP conversions, and 6,141 explicit USDA unknown-coverage markers. All 32,604 have complete local evidence records and 32,260 have complete affirmative coverage. These mapping/catalog counts do not mean plant nativity coverage.

The 2026-10-01 source checks recorded BONAP's [current NAPA route](https://bonap.net/Napa/TaxonMaps/Genus/County/Echinacea), the old route's 404, the MapKey URL, TDC routes, map headers, and the sample embedded date. The sample map says generated 2014-12-14, HTTP Last-Modified is 2017-05-19, and the index footer says last updated 2014-12-15. None proves current biological coverage. NPIN's public autocomplete and accessible `ECAN2` profile route were also verified. The 2026-10-07 manual refresh succeeded and published the current source-ingestion snapshot; BONAP reviews remain hash-bound to the downloaded PNGs and MapKey, and NPIN remains enrichment-only.

Run `pnpm run check:native-coverage` offline to report source discovery, profile enrichment, map markers/categories, and county/state evidence for all 48 states. It reports complete-affirmative ZCTA coverage separately from county mapping, L3, catalog, BONAP occurrence, and NPIN enrichment. Starting coverage is 32,604 county-intersection ZCTAs, 32,537 ecoregion ZCTAs, 3,168 catalog ZCTAs, 28 states without catalog mapping, and zero bundled range records. Catalog data never counts as local nativity.

### Refresh workflow and source review

The BONAP FullTaxonList response baseline is 1,399,603 UTF-8 bytes as verified on 2026-10-01. Refresh requires that reviewed response size, strict TSV rows, a stored SHA-256, and continuity with the previous taxon inventory. A size change fails the staged refresh and preserves last-good data until the completeness baseline is reviewed. Per-run failures and per-source last-success times are included in the workflow coverage artifact.

The monthly/manual importer refreshes USDA PLANTS, BONAP FullTaxonList/SpeciesList/TaxonDetails and linked NAPA county maps, plus NPIN autocomplete and accessible profile enrichment. TDC is identity/presence only; NPIN is enrichment only. BONAP county categories do not enter range evidence until a review row matches the current image hash, exact taxon, MapKey, county FIPS, and current-status decision. The TDC adapter queries each unique lower-48 county FIPS from Census intersections. If an NPIN profile is challenged, the snapshot records `challenge` without bypass. The workflow stages both evidence and source snapshots and publishes the coverage report.

A read-only Hennepin TDC check confirmed the official form binding, paginated `SpeciesList` response, and TaxonDetails profile response: the county result reported 1,479 species and nothospecies while listing 1,853 rows including infraspecific taxa. The importer validates the reported count against species- and nothospecies-rank rows, while retaining total and infraspecific row counts separately. The 2026-10-07 full lower-48 refresh completed successfully: USDA published 108,646 records, BONAP published 3,108 county occurrence queries, 221 map snapshots, and 66,262 reviewed conversions, and NPIN published 231 enrichment records. The numeric USDA nativity-ID domain, current USDA endpoint reuse terms, and per-record USDA source date remain separately documented; `releaseOrObservationDate` is null and retrieval time is recorded on imported claims. BONAP claims remain gated by current-hash conversion review, while NPIN remains enrichment only.
