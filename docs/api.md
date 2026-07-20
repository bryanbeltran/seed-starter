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

## `POST /api/schedules/compare`

Returns conservative, balanced, and aggressive schedules for the same input.

## Saved plans

- `GET /api/saved-plans`
- `POST /api/saved-plans`
- `GET /api/saved-plans/{planId}`
- `PATCH /api/saved-plans/{planId}`
- `DELETE /api/saved-plans/{planId}`

Schedules are regenerated server-side from stored ZIP, crops, and risk profile.
