# Native plants — data sources

**Status:** Recommended stack (locks ADR 007 inputs)  
**Plan:** [native-plants-by-zip.md](./native-plants-by-zip.md)  
**Date:** 2026-07-19

## Recommendation (short)

| Need | Source | Ship in repo? |
|------|--------|----------------|
| ZIP → ecoregion | Census ZCTA centroids × **EPA Level III** polygons | Precomputed `zip-ecoregion.json` only |
| Is it native here? | Currently enabled: **USDA PLANTS** county-or-finer native distribution evidence, matched against every Census county intersection for a ZCTA | `plant-range-evidence.json`; currently empty. BONAP and NPIN are owner-authorized, but no records are enabled until their source-specific claims pass the evidence gate |
| Species identity / candidate selection | **USDA PLANTS** profile references plus approved regional curation | Candidate species catalog and per-species profile URLs; catalog membership is not local nativity evidence |
| Seed-start timing | Our **GHCN frost** + **NRCS Plant Guides** / **MN BWSR** establishment guidelines | Offsets in plant JSON; link guides |
| Enrichment (optional) | Lady Bird Johnson NPIN — owner separately authorizes scraping; use official, accessible routes | The verified autocomplete endpoint supports a taxon crosswalk only; no profile-data workflow is verified |

**Owner-authorized sources:** The project owner confirms permission to bundle BONAP and separately to scrape NPIN. BONAP's citation page requires advance written permission, which the owner confirms has been obtained. NPIN's published policy permits non-commercial data use with attribution and prohibits commercial use; the owner separately confirms permission for this project. These permissions are recorded separately from source terms. The known BONAP and NPIN interfaces below have different limits; neither is currently enabled to supply ZIP nativity claims. Garden-center “native” marketing lists remain unsuitable evidence.

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

### Source choices and constraints

| Source | Verdict | Why |
|--------|---------|-----|
| **BONAP / NAPA** | Owner confirms the required advance written permission for bundling; NAPA county maps and TDC taxon/occurrence interfaces are observed | [NAPA Echinacea page](https://bonap.net/Napa/Genus/Traditional/County/Echinacea) links [county maps](https://bonap.net/MapGallery/County/Echinacea.png). The [TDC FullTaxonList](https://bonap.net/TDC/Query/FullTaxonList) is an approximately 1.4 MB UTF-8 TSV cited 2014. POST [SpeciesList](https://bonap.net/TDC/Query/SpeciesList) returns JSON and filters by county FIPS; a 27053 probe returned 1,479 taxa. POST [TaxonDetails](https://bonap.net/TDC/Query/TaxonDetails) provides profile and verified county occurrence maps. TDC is for identity and occurrence discovery, not native status. MapKey raw county labels are `Native`, `Native Historic`, `Adventive`, and `Exotic`; `rare` was reported by the prior source check but its MapKey meaning is unverified. Only a taxonomy-matched county `Native` category may affirm nativity. The continental background means native to North America only. Map images may conflate infraspecific taxa. Stable IDs, update markers, all-lower-48 coverage, map freshness, and a reviewable map conversion are not established. Do not infer freshness from page dates or HTTP Last-Modified. |
| **Lady Bird Johnson NPIN** | Owner separately authorizes scraping; published data terms are recorded; the verified accessible interface supports taxon crosswalk only | The [WordPress page API](https://www.wildflower.org/wp-json/wp/v2/pages?slug=plants-main) exposes [`/plants/autocomplete-data.php?q=...`](https://www.wildflower.org/plants/autocomplete-data.php?q=...) with common name, scientific name, genus, and ID only. It provides no range data. The [Data Use Policy](https://www.wildflower.org/plants-main/image-use-policy) permits non-commercial data use with attribution and prohibits commercial use; the owner separately confirms permission for this project. Profile pages returned a Cloudflare challenge in the source check. Do not bypass it or claim an export/profile workflow until an official or permission-supported accessible route is verified. |
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

1. USDA PLANTS is the only currently enabled nativity source. The owner confirms BONAP permission; its observed maps and TDC interfaces may support later ingestion only after a reviewable taxon join and map conversion are validated.
2. EPA L3 + Census centroids for join.  
3. Timing from frost + NRCS/BWSR — not vendor DTM.  
4. NPIN scraping is separately owner-authorized under the recorded non-commercial, attribution terms; use the autocomplete response only for taxon crosswalk, and do not bypass profile-page challenges.
5. Only a raw BONAP county category exactly `Native`, with matching taxonomy, can map to affirmative nativity. Preserve all other raw categories; Native Historic, Adventive, Exotic, `rare`, unresolved, and missing categories do not affirm.

---

## Open follow-ups (not blockers for Phase 1)

- Exact PLANTS download path for county×native bulk (site has moved; CloudVault / API variants) — resolve when writing Phase 2 ETL notes.  
- Whether MN county native ∩ L3 51 counties is automated later or stays hand-curated for pilot.  
- Contrast ecoregion species source when Phase 5 starts (still PLANTS + regional NRCS).

## County-level range evidence gate

The ecoregion species JSON is a candidate catalog, not a local nativity assertion. Today, a ZIP recommendation requires an affirmative USDA PLANTS record in `data/natives/plant-range-evidence.json` whose county FIPS matches any Census county intersecting the ZCTA and whose stated resolution is county or finer. BONAP and NPIN are not currently enabled range-evidence sources. Owner authorization alone does not make a source eligible. Each source claim must pass citation, provenance, source terms, taxonomy, source-status semantics, and county-or-finer geography checks. Unknown, historical-only, adventive, exotic, rare, unresolved, state-only, ecoregion-only, or missing evidence never produces an affirmative recommendation. For BONAP, retain the raw county category; only taxonomy-matched `Native` is affirmative. TDC occurrence presence and its `Nativity Continental Native` field are not county nativity evidence.

Each range record carries its source citation and URL, release/observation and retrieval dates, license note, geographic scope, spatial resolution, nativity status, and uncertainty. Unknown dates, scope, resolution, or field meanings are represented explicitly; no date or local claim is inferred from a species profile or L3 catalog entry. `data/natives/native-sources.json` separates `ownerAuthorizationNote` from `sourceTermsStatus` and `licenseNote`, and preserves literal source categories. BONAP's MapKey meaning is observed, but no map-derived claim is enabled until a reviewable map conversion, taxonomy match, and per-map freshness reporting are in place. NPIN's accessible autocomplete is recorded for taxon crosswalk only; it does not expose range data. The 2026-10-01 source-check date is recorded separately from `retrievedAt`; this implementation made no live source request, so `retrievedAt` remains null.

The source observations are dated 2026-10-01; this implementation did not refresh them over the network. BONAP's [NAPA Echinacea page](https://bonap.net/Napa/Genus/Traditional/County/Echinacea) links the per-taxon [county map](https://bonap.net/MapGallery/County/Echinacea.png), and the TDC FullTaxonList, SpeciesList, and TaxonDetails routes are recorded above. The NAPA index says last updated 2014-12-15; the sample map says generated 2014-12-14 and its HTTP Last-Modified is in 2017. Those dates do not establish current map freshness. The MapKey exact URL, stable taxon ID/update-marker behavior, lower-48 coverage, and reviewable map conversion remain unknown. NPIN's [WordPress page API](https://www.wildflower.org/wp-json/wp/v2/pages?slug=plants-main) exposes the autocomplete endpoint and its name/ID fields; an accessible profile-data route and its geography remain unknown. No `retrievedAt` timestamp is claimed for either source.

Run `pnpm run check:native-coverage` offline to report county, L3, catalog, and source-specific range-evidence coverage for every lower-48 state. It reports owner authorization separately from source terms, plus each source's enabled status, county/FIPS counts, and lower-48 state coverage. The Census relationship bundle contains 32,604 lower-48 ZCTAs; 32,597 have a named primary county, and 10 ZCTAs touch county FIPS without a matching 2021 Gazetteer name (46113 on nine ZCTAs and 51515 on one). EPA L3 mapping covers 32,537 ZCTAs, leaving 67 without an L3 match. The candidate catalog maps 3,168 ZCTAs, of which 3,165 have resolved primary-county names; 28 states have no catalog coverage, 20 have partial coverage, and none are fully covered. Local county-range evidence currently covers zero catalog-mapped ZCTAs.

### Refresh workflow and source review

The manual and monthly importer currently refreshes the official USDA `PlantSearch`, `PlantProfile`, and `PlantProfile/getDownloadDistributionDocumentation` endpoints plus the NRCS PLANTS Counties MapServer. It takes nativity from the layer's published `Symbol` text and leaves numeric `plant_nativity_id` uninterpreted; county FIPS are joined only when a county name identifies one unique U.S. state/county row in the same plant's official Distribution Documentation and that row is in the lower 48. Uniquely identified non-lower-48 rows are excluded; ambiguous names stay unresolved. Profile region status never supplies local evidence. Each run reports per-source readiness and county/state coverage; the monthly workflow publishes this report with the evidence snapshot.

No live source response was retrieved in this implementation. Therefore the numeric USDA nativity-ID domain, current USDA endpoint reuse terms, and per-record source date remain unverified; `releaseOrObservationDate` is null, retrieval timestamps are recorded for imported USDA claims, and the bundled evidence file remains empty. The monthly/manual workflow stages and validates a complete snapshot, preserves the checked-out last-good file on failure, reports source/geographic coverage, and opens a review PR instead of merging data. BONAP and NPIN remain disabled as nativity evidence until their taxon identity, field semantics, geography, and source-specific adapters pass review; the BONAP map conversion must also preserve category and freshness provenance, and NPIN profile access must not bypass Cloudflare.
