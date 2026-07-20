# Plan: Native plants by ZIP

**Status:** Implementing on `cursor/native-plants-impl-3c56` (see [impl audit](./native-plants-impl-audit.md))  
**Priority:** After FAANG polish 1–10  
**Depends on:** ZIP → zone + frost resolve (done); **ADR 007 first**  
**Does not replace:** Vegetable/herb catalog scheduling  
**PR:** [#25](https://github.com/bryanbeltran/seed-starter/pull/25) (this plan)  
**Audit:** [native-plants-plan-audit.md](./native-plants-plan-audit.md) — amendments folded below  
**Data sources:** [native-plants-data-sources.md](./native-plants-data-sources.md) — **where data comes from**

## Goal

User enters a US ZIP → app lists **plants native to that place** and **when to start seeds**, reusing frost-aware timing.

Interview signal: spatial ecology join + frost scheduling reuse — not another seed-vendor scrape.

## User story (v1)

1. Open `/natives` (nav + footer link).
2. Enter ZIP `55423` (or `?zip=55423`).
3. See ecoregion name, frost provenance badge, and a list of natives with:
   - Common + scientific name
   - Habit (forb / grass / shrub / tree)
   - Next actionable seed-start date(s) + short rule (“direct sow ~14d before last frost”)
   - Citation / provenance link
4. Copy states: native to this **ecoregion**, not a yard guarantee. No “save plan” promise in v1.

## Decisions

| # | Decision |
|---|----------|
| 1 | **Native key = EPA Level III ecoregion**, not hardiness zone. Zone 5a MN ≠ 5a CO. |
| 2 | **ZIP → ZCTA centroid → ecoregion id** precomputed into `data/natives/zip-ecoregion.json`. Never mutate `zipClimate.json`. County refine = later. |
| 3 | **Timing = frost offsets** (ADR 004). No soil temp / GDD. **v1 frost anchor = p50 only** (explicit); `?riskProfile=` optional stretch — not required for v1 ship. |
| 4 | **Parallel product surface** — `/natives` + `/api/natives`. Do not merge into veg CropPicker. Do **not** reuse schedule `LocationForm` (season-coupled); share `isValidZip` only. |
| 5 | **Curated depth:** v1 ship = **ecoregion 51 ≥15 cited species**. Second (arid/contrast) L3 = Phase 5 stretch, not a v1 gate. |
| 6 | **ADR 007** before any nativity claims in UI/API. Licenses locked in ADR before Phase 2 curation. Stack: **EPA L3 + Census centroids** (join), **USDA PLANTS** (nativity), **NRCS/BWSR + frost** (timing). See [data sources](./native-plants-data-sources.md). **No BONAP dump.** |
| 7 | Saved “native meadow plans” deferred; deep-link `?zip=` is the bookmark. |

### Rejected

| Approach | Why reject |
|----------|------------|
| Zone-only natives | Scientifically wrong |
| Live scrape of garden-center “native” lists | ToS + marketing noise |
| Full USDA PLANTS dump in v1 | Unmaintainable; weak portfolio signal |
| Stuff into existing schedule form | Different user job; muddies veg Fall story |
| Runtime point-in-polygon | Bundle EPA polygons / geo deps — ETL only |
| Stuff `ecoregionId` into `zipClimate` | Wrong provenance; file already 14MB |

## Data model

```ts
// data/natives/plants.json (species catalog)
type NativePlant = {
  id: string;                    // "echinacea-purpurea"
  commonName: string;
  scientificName: string;
  habit: "forb" | "grass" | "shrub" | "tree" | "vine";
  light?: "full-sun" | "part-shade" | "shade";
  moisture?: "dry" | "medium" | "wet";
  /** If set, outdoor sow this many days before last frost (cold-moist window). */
  stratificationDays?: number;
  needsStratification?: boolean; // true when stratificationDays set or copy-only flag
  method: "direct" | "transplant";
  indoorSowOffsetDays?: number;          // before last frost
  transplantDaysAfterFrost?: number;
  directSowDaysBeforeFrost?: number;     // positive = before
  sourceUrl: string;                     // citation required
  confidence: "high" | "medium" | "low";
};

// data/natives/ecoregion-plants.json
type EcoregionNatives = {
  ecoregionId: string;           // EPA L3 code e.g. "51"
  name: string;
  plantIds: string[];
  provenance: string;
};

// data/natives/zip-ecoregion.json — shipped (~33k zip → ecoregionId)
// Centroids + EPA polygons = ETL inputs only (centroids often gitignored; fetch in ETL).
```

**Stratification rule (v1):** If `stratificationDays` set → emit outdoor sow at `lastFrostP50 − stratificationDays`. If only `needsStratification: true` without days → show copy flag, **no** invented date shift.

Resolver:

```text
normalizeZip(zip)
  → resolveLocation (zone)           // existing
  → ecoregionId = lookupZipEcoregion(zip)
  → plants = plantsByEcoregion(ecoregionId)
  → frost = resolveFrost({ zone, zip, season: "spring" }, climateRepo)
  → anchor = frost.lastFrostDate (p50)  // v1
  → for each plant: task dates from offsets
```

## Pilot geography

| Ecoregion | v1 role |
|-----------|---------|
| **51 — North Central Hardwood Forests** | **Required.** Demo ZIP `55423`. ≥15 plants. |
| Contrast L3 (e.g. High Plains near golden `80202`) | **Phase 5.** Lock id in ADR when expanding; proves join isn’t Midwest-only. |

Uncovered ecoregion: show name + “Catalog coming” + link to veg planner. `catalogCoverage: "none"`. Do not invent species.

## Build phases

### Phase 0 — ADR (docs PR)

- Write `docs/adrs/007-native-ecoregion.md`
- Lock: L3 key, p50-only timing, pilot 51, Phase 5 contrast candidate, **data stack from [native-plants-data-sources.md](./native-plants-data-sources.md)** (PLANTS / EPA / no BONAP), non-goals
- Link plans index + data-sources stub

**Exit:** ADR merged.

### Phase 1 — Spatial join + eval

- ETL: fetch ZCTA centroids if missing → EPA L3 PIP → `data/natives/zip-ecoregion.json` only
- No runtime geo dependency
- Golden: `data/natives/golden-zips.json` — reuse ZIP keys from frost `data/golden-zips.json` where possible; expect **exact** `ecoregionId` (not ±14d)
- `scripts/check-native-ecoregion.mjs` — ≥90% golden match; add to `pnpm run check` when file ships
- Unit: `lookupZipEcoregion("55423")` → `"51"` (confirm in ADR)

**Exit:** Join green in CI for golden set; no UI; no species claims.

### Phase 2 — Catalog + timing resolver

- Hand-curate ≥15 plants for ecoregion **51** (licenses per ADR)
- Every plant: `sourceUrl` + frost offsets; stratification via `stratificationDays` or flag-only
- `src/natives/` — framework-free (mirror `src/planning/`); do **not** call `buildSchedule`
- Tests: sow date shifts with frost; plant with `stratificationDays` gets earlier outdoor sow
- Audit: fail if missing `sourceUrl` or method offsets

**Exit:** Resolver tests green; JSON validates.

### Phase 3 — API

- `GET /api/natives?zip=` via `apiRoute("natives", handler, { limit: 120 })`
- Response shape:

```json
{
  "zip": "55423",
  "zone": "5a",
  "ecoregion": { "id": "51", "name": "North Central Hardwood Forests" },
  "lastFrostDate": "2026-04-25",
  "frostSource": "climate",
  "plants": [
    {
      "id": "echinacea-purpurea",
      "commonName": "Purple coneflower",
      "scientificName": "Echinacea purpurea",
      "habit": "forb",
      "tasks": [
        { "type": "direct_sow", "date": "2026-04-11", "label": "Direct sow Purple coneflower" }
      ],
      "needsStratification": false,
      "sourceUrl": "https://…",
      "confidence": "high"
    }
  ],
  "catalogCoverage": "full"
}
```

- OpenAPI path (even though `/api/location` is currently undocumented)
- 400 invalid ZIP; 429 rate limit; 200 + `catalogCoverage: "none"` when ecoregion known but empty list

**Exit:** Route tests + smoke curl.

### Phase 4 — UI

- Page `/natives` — dedicated ZIP form, ecoregion header, frost badge, plant list + dates
- `AppHeader` + `AppFooter` links
- Mobile: one column; match planner restraint
- Empty / uncovered ecoregion state
- Deep-link `?zip=55423`

**Exit:** Playwright: ZIP → ≥1 plant with a date (55423).

### Phase 5 — Expand (after v1)

- [x] Contrast L3 + more species (25, 59, 54)
- [x] Optional `?riskProfile=`
- [x] Optional county overlay (Census; context only)
- [x] Fall-sow natives via first fall frost
- [ ] Saved native lists (only if users ask) — deferred

## Key files (expected)

| Area | Path |
|------|------|
| ADR | `docs/adrs/007-native-ecoregion.md` |
| Data | `data/natives/{plants,ecoregion-plants,zip-ecoregion,golden-zips}.json` |
| Domain | `src/natives/resolveNatives.ts`, `lookupEcoregion.ts` |
| API | `src/app/api/natives/route.ts` |
| UI | `src/app/natives/page.tsx`, `src/components/natives/*` |
| Nav | `AppHeader`, `AppFooter` |
| Eval | `scripts/check-native-ecoregion.mjs` |
| Docs | `docs/data-sources.md` natives section |

## Acceptance (v1 ship)

- [ ] ADR 007 accepted (licenses + p50-only + pilot 51)
- [ ] Golden ZIP → ecoregion **exact id** ≥90%
- [ ] Ecoregion 51: ≥15 cited natives with frost rules
- [ ] `GET /api/natives?zip=55423` returns plants + dates
- [ ] `/natives` UI: ZIP → list + start dates + provenance
- [ ] Uncovered ecoregion does not invent species
- [ ] Eval script in `pnpm run check`
- [ ] No zone-only nativity claims in copy
- [ ] Contrast second L3 **not** required for v1

## Out of scope

| Item | Why |
|------|-----|
| Zone-as-native | Wrong |
| Purchase / affiliate links | Trust > commerce |
| Pollinator network graphs | Scope creep |
| Full continental flora | Maintainability |
| Soil / GDD | ADR 004 |
| Replacing veg planner | Different job |
| Runtime geo / EPA polygon bundle | Size; precompute instead |

## Roadmap placement

```text
FAANG polish 1–10  →  ADR 007  →  Phases 1–4  →  Phase 5 expand
```

Does **not** block open polish PRs. Phase 1 does **not** wait on species licenses or contrast L3.

## Risks

| Risk | Mitigation |
|------|------------|
| Polygon / centroid bulk | ETL-only; ship zip→id map (~0.4MB) |
| License on species lists | ADR 007 gate before Phase 2 |
| Users confuse native vs hardy | Copy + separate `/natives` route |
| Stratification oversimplified | `stratificationDays` or flag-only — no fake GDD |
| Centroids missing locally | ETL documents fetch step |

## Related

- [Data sources](./native-plants-data-sources.md)  
- [Audit](./native-plants-plan-audit.md)  
- [ADR 003](../adrs/003-climate-nearest-station.md) — frost percentiles  
- [ADR 004](../adrs/004-frost-first-mvp.md) — frost-first non-goals  
- [FAANG polish](./faang-polish.md) — finish before build  
- [data-sources.md](../data-sources.md) — add natives section when ETL lands  
