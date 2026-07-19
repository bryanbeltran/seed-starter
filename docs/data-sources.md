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
