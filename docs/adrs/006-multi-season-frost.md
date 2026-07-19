# ADR 006: Multi-season frost anchor (spring + fall)

## Status
Accepted

## Context
ADR 004 committed the MVP to a single frost anchor — the last spring frost.
Fall planting requires a symmetric anchor: the **first fall frost**.

## Decision
- `GardenSeason` (`"spring" | "fall"`, reserved `"summer"`) flows through
  `ScheduleInput`, request schema, crop rules, frost resolver, risk model, UI,
  and saved plans.
- `FrostClimateRecord` / `ClimateRecord` include optional
  `firstFallFrostP10/P50/P90`. Resolver chain: climate → station → regional →
  zone (`fallFrostDates.json`).
- `resolveFrost({season})` is the entry point; `resolveLastFrost` /
  `resolveFirstFallFrost` are wrappers.
- Fall risk inversion: conservative → p10 (earlier first frost); aggressive →
  p90 (later).
- Direct-sow fall tasks emit `fall_sow`; transplant path unchanged
  (`indoor_sow → harden_off → transplant`).

## Done (shipped with fall feature)
- Catalog `seasons.fall` for fall-capable crops
- Season UI + saved-plan `season` column
- GHCN ETL parse/emit for fall percentiles (`--refetch-missing-fall`)

## Non-goals
- Soil temp / GDD
- Multi-year succession optimization UI
- Summer season rules (see `docs/plans/summer-season.md`)

## Consequences
- Nationwide `zipClimate.json` must be regenerated after ETL gains fall support
  (see `docs/plans/gap-01-nationwide-fall-climate.md`). Until then, fall
  schedules fall back to station/regional/zone.
- Legacy spring-only TMIN summaries stay valid for spring; they omit fall
  percentiles until re-fetched.
