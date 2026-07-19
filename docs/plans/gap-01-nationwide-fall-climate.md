# Gap 1: Nationwide fall climate regen

**Status:** Done (2026-07-19 regen — 99.7% ZIP fall fill)  
**Priority:** P0 — without this, prod fall uses zone/station fallbacks only

## Gap
`zipClimate.json`: **0/33k** rows have `firstFallFrostP*`. Summaries are spring-only `{year,lastFrost}[]`. ETL code can emit fall fields but cache never re-fetched (skip logic treats spring history as “done”).

## Plan
1. Add `stationHasFallFrostInCache` / `--refetch-missing-fall` on `etl-ghcn-zip-climate.mjs`.
2. Re-fetch GHCN `.dly` for stations missing `firstFallFrost` (~1.6k used by zipClimate).
3. Rewrite `data/ghcn/tmin-frost-summaries.json` with `{year,lastFrost,firstFallFrost?}`.
4. Rebuild `data/zipClimate.json` + `climate-manifest.json` via `--full --write`.
5. Assert fall fill rate (target: >90% of ZIPs with `firstFallFrostP50`).

## Acceptance
- [x] `zipClimate` majority has `firstFallFrostP10/P50/P90` (33,055 / 33,145 = 99.7%)
- [x] Spring `lastFrostP*` drift still within golden tolerance (1 ZIP retargeted)
- [x] Climate gates green after regen
