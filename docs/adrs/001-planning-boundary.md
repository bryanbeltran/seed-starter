# ADR 001: Framework-free planning boundary

## Status

Accepted

## Context

Seed Starter needs explainable, testable scheduling logic and a portfolio-quality architecture.

## Decision

All planting schedule generation lives in `src/planning/` with no React or Next.js imports. API routes resolve location, validate input, call `buildSchedule()`, and serialize results.

## Consequences

- Planning logic is unit-testable in isolation.
- UI never imports generated datasets or schedule engines directly.
- Persisted plans are regenerated server-side from validated input.
