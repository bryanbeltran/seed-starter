# Plan: Variety timing

**Status:** Implemented (A–B)
**Depends on:** Catalog ETL + `resolveCropRules` (done)  
**Independent of:** Fall/summer seasons (can ship in parallel)

## Goal

Make variety selection **honest and useful**: harvest dates reflect variety DTM, users see source/confidence, outliers are gated. Do **not** invent per-variety sow offsets at 2000-row scale.

## Current state

| Fact | Detail |
|------|--------|
| Variety DTM | 2000/2000 have `daysToHarvest` (86.5% scraped high-confidence) |
| Harvest path | `resolveCropRules` already overlays variety `daysToHarvest` |
| Sow path | Variety `indoorSowOffsetDays` schema exists; **0** set; always crop spring |
| UI | Picker shows name only; no DTM / `sourceUrl` |
| Tests | Variety label covered; harvest delta not asserted |
| Outliers | ~547 with \|ΔDTH\| ≥ 14 vs crop; ~26 with \|Δ\| ≥ 60 |

## Decisions

1. **Inherit crop seasons** for sow / harden / transplant. Source of truth stays `seasons.*` + crop defaults.
2. **ETL DTM drives harvest only** — keep current overlay.
3. **No mass variety sow offsets.** Curate rare exceptions only with citation.
4. **Trust over precision:** surface citation; audit/clamp extreme DTM deltas.
5. **Fix mis-filed crops** (wrong crop bucket) before variety timing hacks.

## Build order

### Phase A — Prove + gate (small PR)

1. **Tests:** assert harvest shifts with variety DTH  
   - e.g. pepper crop vs habanero `daysToHarvest` in `schedule.test.ts` / `cropCatalog.test.ts`
2. **Audit:** extend `scripts/audit-timing.mjs`  
   - warn/fail when `|variety.daysToHarvest - crop.daysToHarvest|` ≥ threshold (start warn at 60)
3. **Validate:** optional bounds in `scripts/catalog/lib/validate.mjs`

### Phase B — UI honesty

1. `VarietySelect.tsx` — show DTM (+ confidence badge)
2. `ScheduleResults` / task rows — show variety DTM + link `sourceUrl` when present
3. No live recalc on select required (submit path OK); optional later

### Phase C — Data quality

1. Review \|Δ\| ≥ 60 outliers; fix crop id mapping or drop bad DTM
2. Prefer re-resolve crop over inventing variety sow fields
3. Document DTM semantics: schedule adds DTH after transplant/direct sow (vendor “days to maturity” may differ)

### Phase D — Optional curated sow overrides

Only if horticultural evidence for a named variety:

```ts
// variety
indoorSowOffsetDays?: number  // already in schema
```

- Hand-curate ≤ handful
- Require `sourceUrl` + confidence
- Still no variety-level `seasons` blocks

## Acceptance

- [x] Test fails if variety DTH stops affecting harvest
- [x] Audit surfaces extreme DTM deltas in `pnpm run check` (warn or fail — pick in PR)
- [x] Picker or results show DTM + source for selected variety
- [x] No blanket per-variety spring seasons in catalog
- [x] Outlier list triaged or threshold justified

## Out of scope

- Scraping sow/transplant offsets from vendor pages
- Per-variety `seasons.spring|summer|fall`
- Inferring indoor sow from DTM

## Key files

`src/planning/cropCatalog.ts`, `src/planning/schedule.ts`, `src/planning/catalogSchema.ts`, `scripts/audit-timing.mjs`, `scripts/catalog/lib/{merge,validate}.mjs`, `src/components/seed-form/VarietySelect.tsx`, `ScheduleResults.tsx`, tests under `src/planning/`
