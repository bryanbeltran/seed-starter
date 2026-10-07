# Seed Starter API

## `GET /api/health`

Returns service status and catalog counts.

## `POST /api/schedules`

Build a frost-aware planting schedule.

```json
{
  "zip": "55423",
  "seeds": ["tomato", "lettuce"],
  "riskProfile": "balanced",
  "season": "spring"
}
```

`season` is `"spring" | "summer" | "fall"` (default `"spring"`). Summer uses last-spring-frost offsets; fall uses first-fall-frost.

`seeds` must contain at least one crop. Optional `cropSelections` (for example, `[{"cropId": "tomato", "varietyId": "…"}]`) overrides the seed list for scheduling and must also contain at least one selection when supplied. Empty arrays return `400` with `Select at least one crop.`

## `POST /api/schedules/compare`

Returns conservative, balanced, and aggressive schedules for the same input.

## Saved plans

- `GET /api/saved-plans`
- `POST /api/saved-plans`
- `GET /api/saved-plans/{planId}`
- `PATCH /api/saved-plans/{planId}`
- `DELETE /api/saved-plans/{planId}`

Schedules are regenerated server-side from stored ZIP, crops, optional varieties, risk profile, and season.
