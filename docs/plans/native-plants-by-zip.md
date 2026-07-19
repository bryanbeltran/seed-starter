# Plan: Native plants by ZIP

**Status:** Ready to design (not started)  
**Priority:** After FAANG polish 1–10  
**Depends on:** ZIP → zone + frost resolve (done); new nativity data layer (not done)  
**Does not replace:** Vegetable/herb catalog scheduling

## Goal

User enters a US ZIP. App shows **plants native to that place** and **when to start seeds**, using the same frost-aware timing model where it fits.

Interview signal: spatial ecology join + frost scheduling reuse — not a second seed-vendor scrape.

## Product shape (v1)

1. Input: ZIP (reuse location resolve).
2. Output: ranked list of native species (common + scientific name), habit (forb/grass/shrub/tree), light/moisture tags if cheap.
3. Timing: sow / transplant / outdoor dates relative to **last spring frost** (and optionally first fall frost for fall sow natives).
4. Explicit copy: “Native to this ecoregion / county set — not a guarantee for your yard.”

Out of v1: landscaping design, pollinator graphs, purchase links, invasive watchlists as primary UI.

## Hard problem: what “native” means

Hardiness zone ≠ native range. Zone 5a in Minnesota ≠ zone 5a in Colorado.

| Approach | Pros | Cons |
|----------|------|------|
| **A. EPA Level III/IV ecoregion → species list** | Ecologically honest; ZIP→centroid→ecoregion is doable | Species lists need curation / licensing |
| **B. County / state floras** | Common in USDA PLANTS / BONAP | Coarse; county ≠ ZIP microclimate |
| **C. Lady Bird Johnson / regional NGO APIs** | Curated natives + bloom | ToS, rate limits, incomplete national cover |
| **D. Hardiness zone only** | Easy | **Wrong** — reject as primary key |

**Decision (proposed):** ZIP centroid → **EPA Level III ecoregion** (bundled spatial join) → curated native seed-start list per ecoregion. County overlay optional later for precision.

New ADR required before build (working title: **007 — native range by ecoregion**). ADR 004 frost-first stays; nativity is a **parallel product surface**, not a GDD expansion.

## Timing (reuse, don’t reinvent)

Native seed starting still needs frost anchors for temperate US:

| Plant type | v1 timing rule |
|------------|----------------|
| Warm annual / tender perennial | Indoor sow / transplant offsets from last spring frost (same as catalog crops) |
| Cool hardy forb | Direct sow days before/after last frost |
| Stratification / cold-moist | Flag `needsStratification: true` + calendar window (e.g. outdoor sow 60–90d before last frost); do **not** invent fake GDD |
| Fall-sow native | Optional `seasons.fall` using first fall frost (after fall climate is solid) |

Store rules as `NativePlantDefinition` with frost offsets — same shape spirit as `seasons.spring`, not vendor DTM.

## Data pipeline (sketch)

```text
ZCTA centroid
  → EPA L3 ecoregion id
  → natives[ecoregionId][]  (bundled JSON)
  → resolveFrost(zip) for sow dates
```

ETL ideas (pick one in ADR):
1. Start with **hand-curated 15–30 species × ~20 ecoregions** (portfolio-quality, cited).
2. Later: USDA PLANTS / BONAP county presence → roll up to ecoregion with confidence.
3. Never scrape ToS-hostile garden-center “native” marketing lists as source of truth.

Eval gate (mirror golden ZIPs):
- Fixed ZIP set → expected ecoregion id
- Expected ≥N natives returned
- Sow dates within ±14d of golden for 1–2 fixture species

## API / UI (v1)

- `GET /api/natives?zip=55423` → `{ zone, ecoregion, plants: [{ id, commonName, scientificName, timing, provenance }] }`
- UI: tab or route `/natives` — ZIP + list + frost badge (reuse LocationForm patterns). **Not** jammed into vegetable CropPicker.
- Saved plans: defer; natives are browse-first until demand for “native meadow plan.”

## Build order

1. **ADR 007** — ecoregion nativity; non-goals (zone-as-native, purchase, full US flora).
2. **Spatial join** — ZIP/ZCTA → EPA L3 id fixture + ETL; golden ZIP→ecoregion check.
3. **Catalog slice** — 1–2 ecoregions deep (e.g. N. Central Hardwoods + one arid contrast) with cited species + frost offsets.
4. **Resolver + API** — `resolveNatives(zip)` + OpenAPI.
5. **UI** — dedicated page; link from header/footer.
6. **Expand** — more ecoregions / species; optional county refine; fall sow natives.

## Acceptance (v1)

- [ ] ADR 007 accepted
- [ ] ZIP → ecoregion for golden set (≥90% match vs fixture)
- [ ] ≥1 ecoregion with ≥15 cited natives + sow rules
- [ ] API returns plants + frost-anchored start dates
- [ ] UI: ZIP in → native list + start dates; provenance visible
- [ ] Eval script in `pnpm run check` (ecoregion + sample timing)

## Explicitly out of scope

| Item | Why |
|------|-----|
| Zone-only “natives” | Scientifically wrong |
| Full continental flora dump | Unmaintainable; weak signal |
| Soil / GDD as native gate | ADR 004 |
| Replacing veg catalog | Different user job |
| Summer season | Unrelated; stays deferred |

## Roadmap placement

After FAANG polish slots 1–10. Parallel with summer only if polish is green and ADR 007 is written.

Does **not** block: variety DTM, fall catalog depth, frost default season.

## Key unknowns (resolve in ADR)

1. License / redistribution of chosen species lists
2. Ecoregion geometry source + package size (simplify polygons?)
3. How aggressively to filter “native but not garden-appropriate” (trees vs meadow seed mix)

## Related

- [ADR 003](../adrs/003-climate-nearest-station.md) — frost percentiles
- [ADR 004](../adrs/004-frost-first-mvp.md) — frost-first non-goals
- [FAANG polish](./faang-polish.md) — finish before this
- [data-sources.md](../data-sources.md) — add natives section when ETL lands
