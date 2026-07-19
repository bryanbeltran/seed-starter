# Plan: Native plants by ZIP

**Status:** Ready to build (incremental)  
**Priority:** After FAANG polish 1–10  
**Depends on:** ZIP → zone + frost resolve (done); ADR 007 (write first)  
**Does not replace:** Vegetable/herb catalog scheduling  
**PR:** [#25](https://github.com/bryanbeltran/seed-starter/pull/25) (this plan)

## Goal

User enters a US ZIP → app lists **plants native to that place** and **when to start seeds**, reusing frost-aware timing.

Interview signal: spatial ecology join + frost scheduling reuse — not another seed-vendor scrape.

## User story (v1)

1. Open `/natives` (or “Native plants” in nav).
2. Enter ZIP `55423`.
3. See ecoregion name, frost provenance badge, and a list of natives with:
   - Common + scientific name
   - Habit (forb / grass / shrub / tree)
   - Next actionable seed-start date(s) + short rule (“direct sow ~14d before last frost”)
   - Citation / provenance link
4. Copy states: native to this **ecoregion**, not a yard guarantee.

## Decisions

| # | Decision |
|---|----------|
| 1 | **Native key = EPA Level III ecoregion**, not hardiness zone. Zone 5a MN ≠ 5a CO. |
| 2 | **ZIP → ZCTA centroid → ecoregion id** (bundled join). County refine = later. |
| 3 | **Timing = frost offsets** (ADR 004). No soil temp / GDD for natives v1. |
| 4 | **Parallel product surface** — `/natives` + `/api/natives`. Do not merge into veg CropPicker. |
| 5 | **Curated depth over continental dump** — pilot 2 ecoregions × ≥15 species each, cited. |
| 6 | **ADR 007** before code that ships nativity claims. |
| 7 | Saved “native meadow plans” deferred. |

### Rejected

| Approach | Why reject |
|----------|------------|
| Zone-only natives | Scientifically wrong |
| Live scrape of garden-center “native” lists | ToS + marketing noise |
| Full USDA PLANTS dump in v1 | Unmaintainable; weak portfolio signal |
| Stuff into existing schedule form | Different user job; muddies veg Fall story |

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
  needsStratification?: boolean;
  method: "direct" | "transplant";
  // spring frost offsets (same spirit as crop seasons.spring)
  indoorSowOffsetDays?: number;          // before last frost
  transplantDaysAfterFrost?: number;
  directSowDaysBeforeFrost?: number;     // positive = before
  sourceUrl: string;                     // citation required
  confidence: "high" | "medium" | "low";
};

// data/natives/ecoregion-plants.json
type EcoregionNatives = {
  ecoregionId: string;           // EPA L3 code e.g. "51"
  name: string;                  // "North Central Hardwood Forests"
  plantIds: string[];
  provenance: string;
};

// data/natives/zip-ecoregion.json (or derived at ETL)
// zip → ecoregionId for ~33k ZCTAs (or on-the-fly point-in-polygon if size OK)
```

Resolver:

```text
normalizeZip(zip)
  → resolveLocation (zone)
  → ecoregionId = lookupZipEcoregion(zip)
  → plants = plantsByEcoregion(ecoregionId)
  → frost = resolveLastFrost({ zone, zip })
  → for each plant: sow/transplant Date via frost offsets
```

## Pilot geography

| Ecoregion | Why |
|-----------|-----|
| **51 — North Central Hardwood Forests** | Matches demo ZIP `55423`; frost story already strong |
| **One arid/contrast L3** (e.g. High Plains or Chihuahuan — pick in ADR) | Proves join isn’t Midwest-only theater |

v1 UI: if ZIP maps to an ecoregion **without** a plant list → show ecoregion name + “Catalog coming; frost dates still resolve” + link to veg planner. Fail honest, don’t invent species.

## Build phases

### Phase 0 — ADR (docs PR)

- Write `docs/adrs/007-native-ecoregion.md`
- Lock: L3 key, non-goals, attribution, pilot ecoregions, license notes
- Link from plans index + data-sources stub

**Exit:** ADR merged.

### Phase 1 — Spatial join + eval

- ETL: ZCTA centroids × EPA L3 polygons → `data/natives/zip-ecoregion.json` (or compact `ecoregionId` field on existing zip table)
- Golden: `data/natives/golden-zips.json` — ZIP → expected `ecoregionId`
- `scripts/check-native-ecoregion.mjs` — ≥90% golden match; wire into `pnpm run check` when natives ship
- Unit: `lookupZipEcoregion("55423")` → expected id

**Exit:** Join green in CI for golden set; no UI yet.

### Phase 2 — Catalog + timing resolver

- Hand-curate ≥15 plants for ecoregion 51 (+ contrast L3 if ready)
- Every plant: `sourceUrl` + frost offsets + stratification flag where needed
- `src/natives/resolveNatives.ts` — pure domain (framework-free, like `src/planning/`)
- Tests: sow date shifts with frost; stratification plant gets early outdoor window
- Audit: fail if plant missing `sourceUrl` or offsets

**Exit:** Resolver tests green; JSON validates.

### Phase 3 — API

- `GET /api/natives?zip=`
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

- OpenAPI entry; rate limit like location
- 400 invalid ZIP; 200 with `catalogCoverage: "none"` when ecoregion known but empty list

**Exit:** API route tests + smoke curl.

### Phase 4 — UI

- Page `/natives` — ZIP input, ecoregion header, frost badge, plant list + dates
- Nav/footer link from main app
- Mobile: one column; no card-hero theater (match planner restraint)
- Empty / uncovered ecoregion state (honest)
- Optional: deep-link `?zip=55423`

**Exit:** Manual + light Playwright: ZIP → ≥1 plant with a date.

### Phase 5 — Expand (after v1)

- More L3 ecoregions / species
- Optional county overlay for confidence badge
- Fall-sow natives via first fall frost
- Saved native lists (only if users ask)

## Key files (expected)

| Area | Path |
|------|------|
| ADR | `docs/adrs/007-native-ecoregion.md` |
| Data | `data/natives/{plants,ecoregion-plants,zip-ecoregion,golden-zips}.json` |
| Domain | `src/natives/resolveNatives.ts`, `lookupEcoregion.ts` |
| API | `src/app/api/natives/route.ts` |
| UI | `src/app/natives/page.tsx`, `src/components/natives/*` |
| Eval | `scripts/check-native-ecoregion.mjs` |
| Docs | `docs/data-sources.md` natives section |

## Acceptance (v1 ship)

- [ ] ADR 007 accepted
- [ ] Golden ZIP → ecoregion ≥90%
- [ ] Ecoregion 51: ≥15 cited natives with frost rules
- [ ] `GET /api/natives?zip=55423` returns plants + dates
- [ ] `/natives` UI: ZIP → list + start dates + provenance
- [ ] Uncovered ecoregion does not invent species
- [ ] Eval script in check (or documented behind flag until Phase 1 lands)
- [ ] No zone-only nativity claims in copy

## Out of scope

| Item | Why |
|------|-----|
| Zone-as-native | Wrong |
| Purchase / affiliate links | Trust > commerce |
| Pollinator network graphs | Scope creep |
| Full continental flora | Maintainability |
| Soil / GDD | ADR 004 |
| Replacing veg planner | Different job |

## Roadmap placement

```text
FAANG polish 1–10  →  ADR 007  →  Phases 1–4 (this plan)  →  Phase 5 expand
```

Does **not** block open polish PRs (#19–#24). Parallel with summer only after polish + ADR 007.

## Risks

| Risk | Mitigation |
|------|------------|
| Polygon bundle too large | Precompute zip→id; ship ids only |
| License on species lists | Prefer public-domain / cited floras; document in ADR |
| Users confuse native vs hardy | Copy + separate `/natives` route |
| Stratification oversimplified | Flag + window text; no fake precision |

## Related

- [ADR 003](../adrs/003-climate-nearest-station.md) — frost percentiles  
- [ADR 004](../adrs/004-frost-first-mvp.md) — frost-first non-goals  
- [FAANG polish](./faang-polish.md) — finish before build  
- [data-sources.md](../data-sources.md) — add natives section when ETL lands  
