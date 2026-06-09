# Climate & location data sources

## ZIP → USDA hardiness zone

| Priority | Source | Coverage |
|----------|--------|----------|
| 1 | `data/zipZones.json` fixture | 15 sample ZIPs (offline/dev) |
| 2 | [PHZM API](https://phzmapi.org) | US ZIP codes (USDA Plant Hardiness Zone Map) |

## Last spring frost (32°F / 0°C)

| Priority | Source | Coverage |
|----------|--------|----------|
| 1 | `data/zipClimate.json` | ZIPs with centroids in `data/zipCentroids.json` |
| 2 | `src/planning/data/stationFrost.json` | 6 ZIPs (NOAA GHCN-D fixture) |
| 3 | `src/planning/data/regionalFrost.json` | Zones 3a–9b (regional buckets) |
| 4 | `src/planning/frostDates.json` | Zone medians 3a–11b |

Climate records include `lastFrostP10`, `lastFrostP50`, `lastFrostP90`. Risk profiles map to p90 / p50 / p10 when percentiles exist.

### ETL pipeline

```bash
pnpm run etl:climate              # preview
pnpm run etl:climate -- --write # regenerate data/zipClimate.json
pnpm run etl:climate -- --fetch-stations --write  # merge NOAA station inventory
```

Method: ZCTA centroid → nearest GHCN station → median last spring TMIN below 0°C per year → percentiles.

Bundled samples: `data/ghcn/stations.json`, `data/ghcn/tmin-samples.json`. Full lower-48 coverage requires Census ZCTA centroids + GHCN-Daily ingest (Phase E).

### Attribution

- **NOAA NCEI GHCN-Daily** — temperature observations
- **USDA PHZM** — plant hardiness zones
- **Saved plans** store `climateDataVersion`; stale plans are flagged when data is refreshed

### Refresh cadence (target)

- Climate ETL: weekly (see `.github/workflows/climate-etl.yml`)
- PHZM zone lookup: 24h HTTP cache
