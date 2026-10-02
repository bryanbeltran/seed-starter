# Climate & location data sources

## ZIP → USDA hardiness zone

| Priority | Source | Coverage |
|----------|--------|----------|
| 1 | `data/zipZones.json` fixture | 15 sample ZIPs (offline/dev) |
| 2 | `data/zipZones-phzm.json` | PRISM 2023 USDA PHZM (~40k ZIPs) |
| 3 | [PHZM API](https://phzmapi.org) | Fallback for ZIPs not in bundled table |

## Last spring frost (32°F / 0°C)

| Priority | Source | Coverage |
|----------|--------|----------|
| 1 | `data/zipClimate.json` | US ZCTA centroids + nearest GHCN station with TMIN |
| 2 | `src/planning/data/stationFrost.json` | 6 ZIPs (NOAA GHCN-D fixture) |
| 3 | `src/planning/data/regionalFrost.json` | Zones 3a–9b (regional buckets) |
| 4 | `src/planning/frostDates.json` | Zone medians 3a–11b |

Climate records include `lastFrostP10`, `lastFrostP50`, `lastFrostP90`. Risk profiles map to p90 / p50 / p10 when percentiles exist.

### ETL pipeline

```bash
pnpm run etl:climate              # preview
pnpm run etl:climate -- --write # regenerate data/zipClimate.json
pnpm run etl:phzm -- --write
pnpm run etl:climate -- --fetch-stations --fetch-daily-representative --full --write
```

Method: ZCTA centroid → nearest GHCN station with TMIN → median last spring TMIN below 0°C per year → percentiles. Zones from PRISM PHZM backfill.

Station pool: `data/ghcn/stations-us-tmin.json` (US inventory filter). TMIN cache: `data/ghcn/tmin-parsed.json`. Coverage manifest: `data/climate-manifest.json`.

Eval gates (golden ZIPs ±14d, drift/monotonic percentiles): see README **Climate eval** and `data/golden-zips.json`.

### Attribution

- **NOAA NCEI GHCN-Daily** — temperature observations
- **USDA PHZM** — plant hardiness zones
- **Saved plans** store `climateDataVersion`; stale plans are flagged when data is refreshed

### Refresh cadence (target)

- Climate ETL: weekly (see `.github/workflows/climate-etl.yml`)
- PHZM zone lookup: 24h HTTP cache

## Native plants (EPA Level III + reviewed county sources)

| Layer | Source |
|-------|--------|
| ZIP → ecoregion | Census ZCTA centroids × EPA L3 shapefile → `data/natives/zip-ecoregion.json` (`pnpm run etl:natives-ecoregion -- --write`) |
| ZIP → county intersections | Census ZCTA-county relationship (2010, all intersections) + 2021 gazetteer → `data/natives/zip-county.json` (`pnpm run etl:natives-county -- --fetch --write`); the largest population-share county remains the display overlay |
| Species candidates | Hand-curated species profiles in `data/natives/plants.json`, grouped by EPA L3 in `ecoregion-plants.json`; catalog membership is not local nativity evidence |
| Local nativity recommendation | Eligible affirmative county-or-finer evidence for every Census county FIPS intersecting the ZIP in `data/natives/plant-range-evidence.json`; unresolved, missing, or non-native county evidence leaves whole-ZIP nativity unestablished |
| Seed timing | GHCN frost percentiles + `riskProfile` + NRCS / regional guidelines |

See [ADR 007](adrs/007-native-ecoregion.md) and [native-plants-data-sources.md](plans/native-plants-data-sources.md).

### Native coverage and gaps

The BONAP FullTaxonList response baseline is 1,399,603 UTF-8 bytes as verified on 2026-10-01. Refresh requires that reviewed response size, strict TSV rows, a stored SHA-256, and continuity with the previous taxon inventory. A size change fails the staged refresh and preserves last-good data until the completeness baseline is reviewed. Per-run failures and per-source last-success times are included in the workflow coverage artifact.

Run `pnpm run check:native-coverage` for an offline JSON report covering all 48 contiguous states, county and EPA L3 mapping, catalog-only coverage, BONAP discovery/maps, NPIN enrichment, approved county claims, update markers, and source readiness. Discovery, profile enrichment, county mapping, and ecoregion mapping are separate from local nativity. The monthly/manual refresh stages and validates evidence and source snapshots before replacement, keeps last-good data on failure, and reports all-county affirmative ZCTA coverage.

BONAP/NAPA: The project owner confirms the advance written permission required by BONAP's [citation page](http://bonap.org/citation.html) for bundling in this project. Use the current [NAPA genus county route](https://bonap.net/Napa/TaxonMaps/Genus/County/Echinacea), then discover per-taxon PNG links from that live page; the older `/Napa/Genus/Traditional/County/` route is not used. TDC [FullTaxonList](https://bonap.net/TDC/Query/FullTaxonList) is a UTF-8 TSV cited 2014 with family, genus, and scientific name but no stable ID. The TDC page posts [SpeciesList](https://bonap.net/TDC/Query/SpeciesList) as form data using `fipsCodeSearch`; the adapter retrieves all `NextPage` results. `TaxonList` row counts include infraspecific taxa, while the response description separately reports species and nothospecies. The page's [TaxonDetails](https://bonap.net/TDC/Query/TaxonDetails) response includes BONAP-scoped IDs, profile details, and verified county occurrence maps. Neither TDC occurrence nor `Nativity Continental Native` establishes county nativity. NAPA PNG snapshots record linked URL, retrieval time, SHA-256, ETag, Last-Modified, and generation date read from map content (null when unavailable). These dates remain distinct from page dates and response headers. Each county/FIPS/raw-category conversion is recorded in `data/natives/bonap-county-map-reviews.json`, tied to the current map hash and [MapKey](http://bonap.org/MapKey.html). Reviewers record `mapScopeDecision` as `confirmed_taxon_scope`, `may_conflate_infraspecific`, or `unresolved`; only confirmed taxon scope plus an approved exact taxonomy match, current-status confirmation, and county category exactly `Native` can affirm. Other scope decisions preserve raw county categories as unknown. Historic, Adventive, Exotic, `rare`, unrecognized, and missing categories remain non-affirmative.

NPIN: The project owner separately confirms permission to scrape NPIN data. The [Data Use Policy](https://www.wildflower.org/plants-main/image-use-policy) permits non-commercial data use with attribution and prohibits commercial use. The verified [WordPress page API](https://www.wildflower.org/wp-json/wp/v2/pages?slug=plants-main) exposes [`/plants/autocomplete-data.php?q=...`](https://www.wildflower.org/plants/autocomplete-data.php?q=...). Exact unique autocomplete matches may be enriched through the accessible [`/plants/result.php?id_plant=...`](https://www.wildflower.org/plants/result.php?id_plant=ECAN2) profile route. The JSON has common name, scientific name, genus, and ID only; profile fields include Distribution, Native Distribution, Native Habitat, and horticultural information. State/province and free-text range fields are enrichment only, never county nativity. A challenge response is recorded as unavailable with no bypass attempts.

The regenerated Census relationship table contains 32,604 lower-48 ZCTAs and every county intersection in the 2010 relationship file. Of those, 32,597 have a county name in the 2021 Gazetteer. The 2010 relationship associates nine ZCTAs with county FIPS 46113, while the 2021 Gazetteer uses current Oglala Lakota County FIPS 46102; a tenth ZCTA intersects FIPS 51515, which also has no 2021 Gazetteer name. These vintage gaps remain visible in the report and are not converted to a different county FIPS. The 2010 relationship's own `STATE` field supplies state FIPS for coverage; the resolver still requires an exact county FIPS evidence match.

EPA L3 mapping is available for 32,537 lower-48 ZCTAs, leaving 67 without an ecoregion match. The candidate catalog maps 3,168 ZCTAs across the full crosswalk, including 3 records whose primary county name is unresolved; the previous metadata-resolved subset maps 3,165. Twenty-eight states have no catalog-mapped ZCTAs and 20 have partial mapping; no state is fully mapped. Catalog coverage is distinct from local range-evidence coverage. The offline report lists every state, county and ecoregion gaps, unresolved county-name FIPS, and local evidence gaps.

The county evidence ETL uses the official PLANTS API and NRCS Counties MapServer. `PlantSearch` and `PlantProfile` resolve each curated symbol; Distribution Documentation supplies state and county FIPS; the county layer's published `Symbol` supplies local nativity. The importer joins a layer county name only when it identifies one unique U.S. state/county row across that plant's Distribution Documentation and that row is in the lower 48. Uniquely identified non-lower-48 rows are excluded; ambiguous or missing names remain unresolved, and state prefixes are not used to create county FIPS. Regional profile status is not local evidence. The importer stores a null release/observation date and the retrieval timestamp because a per-record date has not been verified. It records the numeric `plant_nativity_id` as provenance but does not interpret its code domain; status comes from the published `Symbol` text.

The project's existing licensing decision allows citation-based use of PLANTS facts and excludes images. The current endpoint reuse terms and nativity-ID domain could not be checked from this worktree, which has no DNS access to the USDA endpoints. The bundled range-evidence file remains empty. Scheduled and manual runs open a review PR; verify the live endpoint terms and field domains before merging an imported snapshot.

The monthly and manual GitHub refresh retrieves USDA evidence, BONAP discovery/occurrence data and linked NAPA maps, plus NPIN crosswalk/profile enrichment. It stages and validates the range-evidence and source-ingestion JSON before replacing last-good snapshots; content-addressed maps are installed before those JSON references. Fetch, parse, source-identity, or validation failures leave last-good JSON unchanged. The report compares against the 2026-10-01 baseline: 32,604 of 32,604 ZCTAs have county intersections, 32,537 map to EPA L3, 3,168 have catalog entries, 28 states have none, and bundled range-evidence records start at zero. County/L3 mapping is not nativity coverage. BONAP taxon discovery and NPIN enrichment have no baseline comparison; successful refreshes report their measured counts separately from approved all-county affirmative ZCTA coverage.
