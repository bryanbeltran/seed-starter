# ADR 006: Multi-season frost anchor (spring + fall)

## Status
Accepted

## Context
ADR 004 committed the MVP to a single frost anchor — the last spring frost.
Fall planting requires a symmetric anchor: the **first fall frost**. We need
to introduce a second season without duplicating the resolver, risk model, or
schedule builder.

## Decision
- Introduce a `GardenSeason` type (`"spring" | "fall"`, plus reserved
  `"summer"`) that flows through `ScheduleInput`, the request schema, the
  crop-rule resolver, the frost resolver, and the risk model.
- `FrostClimateRecord` gains optional `firstFallFrostP10/P50/P90` fields. When
  absent, the resolver falls back through the same chain used for spring:
  climate → station → regional → zone median (with a `fallFrostDates.json`
  companion to `frostDates.json`).
- `resolveFrost({season})` is the generalized entry point. `resolveLastFrost`
  and a new `resolveFirstFallFrost` are thin season-bound wrappers.
- Risk-profile mapping inverts for fall:
  - Spring: conservative → p90 (later frost), aggressive → p10 (earlier).
  - Fall: conservative → p10 (earlier frost), aggressive → p90 (later).
  The intent is unchanged — conservative always chooses the risk-averse anchor;
  the p-value flips because fall risk means the *first* frost, not the last.
- Schedule builder emits a `fall_sow` task type for the direct-sow branch when
  `season === "fall"`. The transplant branch keeps `indoor_sow → harden_off →
  transplant` (still anchored to fall frost, offsets typically negative).
- `nextFrostDate` handles year rollover identically for fall MM-DD strings.

Explicit non-goals in this ADR:
- Populating `crops.json` with per-crop `seasons.fall` rules.
- Full GHCN ETL for fall percentiles.
- UI for season toggling.

These land in follow-up work; the planning core is prepared for them.

## Consequences
- Schedule shape gains `season` and `frostAnchorDate`. `lastFrostDate` is
  retained as an alias for backwards compatibility with serialization and
  persistence.
- Callers that supply neither `season` nor fall data behave unchanged.
- Fall schedules without catalog `seasons.fall` fall back to flat crop offsets;
  they still schedule, but the offsets are the same shape as spring.
- GHCN ETL code now parses fall frost dates and, when a station has fall
  history, emits `firstFallFrostP10/P50/P90` into `zipClimate.json`. The
  nationwide regeneration is a follow-up CI run — the shipped bundle keeps its
  current spring-only data until that job lands. The per-ZIP cache format is
  back-compatible: legacy spring-only entries `{year,lastFrost}[]` continue to
  drive spring percentiles and simply omit fall percentiles.
