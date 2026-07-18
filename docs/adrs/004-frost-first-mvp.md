# ADR 004: Frost-first scheduling MVP (explicit non-goals)

## Status
Accepted

## Context
Garden calendars can include soil temperature, photoperiod, GDD, and microclimate. Scope creep would dilute the portfolio signal.

## Decision
MVP optimizes for **last spring frost** as the primary schedule anchor:
- Indoor sow / harden / transplant / harvest relative to frost + crop rules.
- Risk profiles shift frost percentile (p90/p50/p10).

Explicit non-goals (until a later ADR):
- Soil temp / GDD models
- Elevation or urban-heat correction beyond station distance confidence
- Multi-year succession optimization UI

## Consequences
- Clear product story and testable invariants.
- Confidence badge communicates uncertainty without fake precision.
