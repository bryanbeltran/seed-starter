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

## Native plants (EPA Level III + USDA PLANTS)

| Layer | Source |
|-------|--------|
| ZIP → ecoregion | Census ZCTA centroids × EPA L3 shapefile → `data/natives/zip-ecoregion.json` (`pnpm run etl:natives-ecoregion -- --write`) |
| ZIP → county intersections | Census ZCTA-county relationship (2010, all intersections) + 2021 gazetteer → `data/natives/zip-county.json` (`pnpm run etl:natives-county -- --fetch --write`); the largest population-share county remains the display overlay |
| Species candidates | Hand-curated species profiles in `data/natives/plants.json`, grouped by EPA L3 in `ecoregion-plants.json`; catalog membership is not local nativity evidence |
| Local nativity recommendation | Currently, only an affirmative USDA PLANTS county-or-finer claim matching any Census county FIPS intersecting the ZIP in `data/natives/plant-range-evidence.json`; BONAP/NPIN source claims remain disabled pending source-specific adapters and validation |
| Seed timing | GHCN frost percentiles + `riskProfile` + NRCS / regional guidelines |

See [ADR 007](adrs/007-native-ecoregion.md) and [native-plants-data-sources.md](plans/native-plants-data-sources.md).

### Native coverage and gaps

Run `pnpm run check:native-coverage` for an offline JSON report covering all 48 lower-48 states, county and EPA L3 mapping, catalog-only coverage, local source-specific county-range evidence, owner authorization, source-terms status, and source metadata. Catalog coverage is reported separately from local range evidence. The monthly/manual refresh stages and validates snapshots before replacement, keeps last-good data on failure, and reports per-source county and lower-48 state coverage.

BONAP/NAPA: The project owner confirms the advance written permission required by BONAP's [citation page](http://bonap.org/citation.html) for bundling in this project. The verified [NAPA Echinacea page](https://bonap.net/Napa/Genus/Traditional/County/Echinacea) links a [per-taxon county map](https://bonap.net/MapGallery/County/Echinacea.png). Its MapKey defines dark olive-green county fills as `Native`, orange as `Native Historic`, teal as `Adventive`, and dark navy as `Exotic`. The state-background dark green means native to North America only; a county may be Adventive even when the continental background is native. TDC [FullTaxonList](https://bonap.net/TDC/Query/FullTaxonList) returns an approximately 1.4 MB UTF-8 TSV cited 2014; POST [SpeciesList](https://bonap.net/TDC/Query/SpeciesList) returns JSON filtered by county FIPS (the 27053 probe returned 1,479 taxa); POST [TaxonDetails](https://bonap.net/TDC/Query/TaxonDetails) provides profile and verified county occurrence maps. TDC is used for taxon identity and occurrence discovery; occurrence and `Nativity Continental Native` do not establish county native status. Stable IDs, update markers, lower-48 coverage, and a reviewable map conversion are unknown. Species maps may conflate infraspecific taxa, so no species claim is made unless taxonomy matches. Only a taxonomy-matched county `Native` category may affirm nativity; preserve every raw category and keep historic, adventive, exotic, rare, unresolved, and missing statuses non-affirmative. The sample map says generated 2014-12-14, its HTTP Last-Modified is in 2017, and the NAPA index says last updated 2014-12-15. These do not establish current freshness; poll ETag, Last-Modified, and content, and report the map's own generation date. The source observations are dated 2026-10-01; this implementation did not retrieve source responses, so `retrievedAt` remains null.

NPIN: The project owner separately confirms permission to scrape NPIN data. The [Data Use Policy](https://www.wildflower.org/plants-main/image-use-policy) permits non-commercial data use with attribution and prohibits commercial use. The verified [WordPress page API](https://www.wildflower.org/wp-json/wp/v2/pages?slug=plants-main) exposes the public [`/plants/autocomplete-data.php?q=...`](https://www.wildflower.org/plants/autocomplete-data.php?q=...) endpoint. Its JSON contains common name, scientific name, genus, and ID only, so it supports taxon crosswalk and supplies no range evidence. The source check dated 2026-10-01 found a Cloudflare challenge on plant profile pages. A profile scrape/export route and its range fields, geographic coverage, and resolution remain unknown. Do not bypass the challenge.

The regenerated Census relationship table contains 32,604 lower-48 ZCTAs and every county intersection in the 2010 relationship file. Of those, 32,597 have a county name in the 2021 Gazetteer. The 2010 relationship associates nine ZCTAs with county FIPS 46113, while the 2021 Gazetteer uses current Oglala Lakota County FIPS 46102; a tenth ZCTA intersects FIPS 51515, which also has no 2021 Gazetteer name. These vintage gaps remain visible in the report and are not converted to a different county FIPS. The 2010 relationship's own `STATE` field supplies state FIPS for coverage; the resolver still requires an exact county FIPS evidence match.

EPA L3 mapping is available for 32,537 lower-48 ZCTAs, leaving 67 without an ecoregion match. The candidate catalog maps 3,168 ZCTAs across the full crosswalk, including 3 records whose primary county name is unresolved; the previous metadata-resolved subset maps 3,165. Twenty-eight states have no catalog-mapped ZCTAs and 20 have partial mapping; no state is fully mapped. Catalog coverage is distinct from local range-evidence coverage. The offline report lists every state, county and ecoregion gaps, unresolved county-name FIPS, and local evidence gaps.

The county evidence ETL uses the official PLANTS API and NRCS Counties MapServer. `PlantSearch` and `PlantProfile` resolve each curated symbol; Distribution Documentation supplies state and county FIPS; the county layer's published `Symbol` supplies local nativity. The importer joins a layer county name only when it identifies one unique U.S. state/county row across that plant's Distribution Documentation and that row is in the lower 48. Uniquely identified non-lower-48 rows are excluded; ambiguous or missing names remain unresolved, and state prefixes are not used to create county FIPS. Regional profile status is not local evidence. The importer stores a null release/observation date and the retrieval timestamp because a per-record date has not been verified. It records the numeric `plant_nativity_id` as provenance but does not interpret its code domain; status comes from the published `Symbol` text.

The project's existing licensing decision allows citation-based use of PLANTS facts and excludes images. The current endpoint reuse terms and nativity-ID domain could not be checked from this worktree, which has no DNS access to the USDA endpoints. The bundled range-evidence file remains empty. Scheduled and manual runs open a review PR; verify the live endpoint terms and field domains before merging an imported snapshot.

The monthly and manual GitHub refresh stages and validates a complete evidence snapshot before replacing the workflow worktree's last-good file, runs the focused native tests and offline coverage report, and opens a review PR when data changes. Download, taxon, or provenance validation failures leave the checked-out last-good file unchanged; unresolved individual county-name joins stay as explicit records with null FIPS and cannot match a ZIP.
