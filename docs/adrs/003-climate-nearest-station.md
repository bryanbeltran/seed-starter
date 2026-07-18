# ADR 003: Climate via nearest GHCN station with distance confidence

## Status
Accepted

## Context
True ZIP-level frost needs dense observations. Full GHCN TMIN for every station is too large for cold starts.

## Decision
1. Filter US stations with recent TMIN inventory (~8k).
2. Fetch frost summaries for a 0.75° representative grid (~1.7k).
3. Assign each ZCTA centroid the nearest station **with** frost history.
4. Expose p10/p50/p90; map risk profiles to those percentiles.
5. Confidence from distance: high ≤25 km, medium ≤60 km, low ≤200 km.
6. Distance >200 km → reject climate tier (fallback chain).

## Consequences
- Nationwide coverage with bounded artifact size.
- Alaska/HI/territory extremes surface as outliers → fallback, not bogus frost dates.
- Refresh via ETL; drift CI gates zip count, zone fill, p95 distance.
