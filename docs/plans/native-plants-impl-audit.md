# Native plants — implementation audit log

**Branch:** `cursor/native-plants-impl-3c56`  
**Date:** 2026-07-19

## Phase 0 — ADR

| Check | Result |
|-------|--------|
| Locks L3 not zone | Yes |
| PLANTS / no BONAP | Yes |
| p50 timing | Yes |
| Pilot 51 | Yes |

**Verdict:** Ship ADR. Proceed Phase 1.

## Phase 1 — Spatial join

| Finding | Action |
|---------|--------|
| gaftp.epa.gov 404 | Use S3 mirror `dmap-prod-oms-edc…/us_eco_l3.zip` |
| 0 matches initially | Shapefile is **Albers** — project WGS84 centroids with proj4 |
| 55423 → 51 | Confirmed |
| Coverage | 32,590 / 33,144 matched; misses mostly non-CONUS |
| Artifact size | 1.6MB — OK vs 14MB zipClimate |

**Verdict:** Green. Golden exact-id check wired.

## Phase 2 — Catalog + resolver

| Check | Result |
|-------|--------|
| ≥15 plants for 51 | 16 |
| stratificationDays | Early sow for stratifiers |
| Uncovered ecoregion | `catalogCoverage: "none"` |
| No buildSchedule | Yes |

**Verdict:** Ship.

## Phase 3–4 — API + UI

| Check | Result |
|-------|--------|
| apiRoute limit 120 | Yes |
| OpenAPI path | Yes |
| `/natives` + nav/footer | Yes |
| `?zip=` deep-link | Yes |

**Verdict:** Ship; Playwright optional follow-up.

## Phase 5 — Expand (this pass)

| Item | Result |
|------|--------|
| Lint CI | Fixed `<a href="/">` → `Link` |
| Contrast L3 25 High Plains | 16 plants; 80202 full coverage |
| Fall dormant | `?season=fall` → `fall_sow` vs first fall frost |
| e2e | `e2e/natives.spec.ts` |
| Artifact size | Compacted zip→id + names map (~415KB vs 1.6MB) for CI/runtime |
