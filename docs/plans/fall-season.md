# Plan: Fall season

**Status:** Ready to build  
**Depends on:** Catalog season schema (done)  
**Blocks:** Summer season UI (shared season plumbing)

## Goal

User picks **fall** as the garden season. Schedule anchors on **first fall frost** (p10/p50/p90), uses `seasons.fall` crop rules, emits fall tasks.

## Current gaps

| Layer | Today |
|-------|--------|
| Catalog | `seasons.fall` schema exists; **0/90** crops populated |
| Climate | Spring `lastFrostP*` only; GHCN parser skips month > 7 |
| Scheduler | Always `springRulesFromCrop` + `resolveLastFrost` |
| Task types | `fall_sow` reserved, never emitted |
| API / UI / DB | No `season` field |

## Decisions

1. **MVP = spring + fall only.** Summer later.
2. **Anchor = `firstFallFrost`.** Mirror spring GHCN nearest-station model (ADR 003 pattern).
3. **Risk inversion:** conservative → earlier first frost (`p10`); balanced → `p50`; aggressive → later (`p90`). Document in ADR.
4. **One plan = one season.** Save/share carries `season`.
5. **Amend ADR 004** (or add ADR 006) before shipping fall climate as first-class.

## Build order

### 1. ADR
- Amend `docs/adrs/004-frost-first-mvp.md` or add `006-multi-season-frost.md`
- State: last spring frost + first fall frost; risk semantics per season
- Non-goals unchanged: soil temp, GDD, multi-year succession UI

### 2. Climate ETL
- Extend `scripts/lib/ghcn-zip-climate.mjs`:
  - Parse Aug–Dec (or full year) TMIN < 0°C
  - `firstFallFrostMmDdPerYear` → percentiles
- Rebuild `data/ghcn/tmin-frost-summaries.json` + `data/zipClimate.json`
- Add `firstFallFrostP10|P50|P90` to `ClimateRecord` (`src/climate/types.ts`)
- Golden ZIPs + `scripts/check-golden-climate.mjs`
- Fallback chain: climate → station → regional → zone (mirror spring)

**Risk:** cached `.dly` / summaries are spring-trimmed — may need re-fetch.

### 3. Planning core
- `resolveFirstFallFrost` (or generalize frost resolver by season)
- `fallRulesFromCrop` in `seasonRules.ts` when `anchor === "firstFallFrost"`
- `resolveCropRules(cropId, varietyId, season)`
- `buildSchedule` / `tasksForCrop` take `season`; emit `fall_sow` (+ transplant/harden/harvest as today)
- `selectFrostDate` season-aware risk mapping
- Year rollover for autumn `MM-DD` (not spring `nextFrostDate` assumptions)

### 4. Catalog
- Curate `seasons.fall` for fall-capable crops (brassicas, greens, garlic, etc.)
- Helper `fallSeason()` in `scripts/catalog/lib/cropDefaults.mjs`
- Validate: fall optional; if present, require known anchor
- Extend `audit-timing.mjs` for fall offsets

### 5. API + persistence
- `scheduleRequestSchema`: `season: "spring" | "fall"` (default `"spring"`)
- Saved plans: `season` column (new migration)
- `serializeSchedule`: include `fall_sow` in sow dates
- OpenAPI update

### 6. UI
- Season control on `SeedForm` (default = next actionable; heuristic can be spring-biased until fall climate ships)
- Filter picker to crops with selected season rules
- Labels: “First fall frost”; `TaskTimeline` icon for `fall_sow`
- Load/save plan restores season

### 7. Tests
- Unit: fall rules, risk inversion, year rollover, serialize
- Golden climate ZIPs with fall percentiles
- E2E: select fall → schedule shows fall frost + fall tasks

## Acceptance

- [ ] Fall ZIP schedule uses `firstFallFrostP*` when climate present
- [ ] Conservative fall frost earlier than aggressive
- [ ] Crops without `seasons.fall` hidden/disabled in fall mode
- [ ] Saved plan round-trips `season`
- [ ] ADR updated; `pnpm run check` green

## Out of scope

- Summer season rules
- Succession optimizer / multi-year UI
- Soil temp / GDD

## Key files

`scripts/lib/ghcn-zip-climate.mjs`, `src/climate/types.ts`, `src/planning/{frostResolver,seasonRules,cropCatalog,schedule,riskProfile,types}.ts`, `data/catalog/crops.json`, `src/components/seed-form/*`, `db/migrations/`, `docs/adrs/`
