# ADR 006: Multi-season frost anchor (spring + summer + fall)

## Status
Accepted (summer expand 2026-07-20)

## Context
ADR 004 committed the MVP to a single frost anchor — the last spring frost.
Fall planting requires a symmetric anchor: the **first fall frost**.
Summer succession plantings reuse the **last spring frost** with later offsets
(no midsummer GDD).

## Decision
- `GardenSeason` (`"spring" | "summer" | "fall"`) flows through
  `ScheduleInput`, request schema, crop rules, frost resolver, risk model, UI,
  and saved plans.
- `FrostClimateRecord` / `ClimateRecord` include optional
  `firstFallFrostP10/P50/P90`. Resolver chain: climate → station → regional →
  zone (`fallFrostDates.json`).
- `resolveFrost({season})` is the entry point; summer resolves like spring
  (last-spring-frost percentiles).
- Fall risk inversion: conservative → p10 (earlier first frost); aggressive →
  p90 (later). Summer uses spring mapping (no invert).
- Direct-sow fall tasks emit `fall_sow`; summer may emit `succession_sow`
  when `successionIntervalDays` is set on `seasons.summer`.

## Done
- Catalog `seasons.fall` / `seasons.summer` for capable crops
- Season UI (3-way) + saved-plan `season` column
- GHCN ETL parse/emit for fall percentiles (`--refetch-missing-fall`)
- Default-season heuristic: spring → summer → fall

## Non-goals
- Soil temp / GDD
- Multi-year succession optimization UI
- Photoperiod / heat-stress models

## Consequences
- Nationwide `zipClimate.json` must include fall percentiles for climate-tier fall.
- Summer schedules never invent a new climate column.
