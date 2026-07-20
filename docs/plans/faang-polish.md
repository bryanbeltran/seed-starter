# FAANG polish roadmap

**Goal:** High-signal senior portfolio — domain depth, production judgment, measurable correctness. Not feature sprawl.

**State (2026-07-20):** Slots 1–8 + natives (#26) on main. Slots 9–10 (fall catalog + fallbacks) in flight.

## Recommended implementation order

Strict sequence where deps matter. Parallel where noted.

```text
1 Merge #18                    → docs/plans/polish-01-merge-fall-pr.md
2 Prod Fall smoke              → docs/plans/polish-02-prod-fall-smoke.md
3 README eval narrative        → docs/plans/polish-03-readme-eval.md
4 Cross-year frost test        ← before default-season
5 Demo GIF (Fall beat)           after smoke; parallel OK with 3–4
6 Frost-aware default season + SeasonPicker a11y (one PR)
7 Variety timing honesty         independent of 6; can start in parallel
8 Season on share / print / plan list
9 Fall catalog → ~40–50 crops
10 Thicken fall zone/regional fallbacks
```

### Why this order

| # | Item | Depends on | Why here |
|---|------|------------|----------|
| 1 | Merge #18 | CI green | Unmerged work isn’t portfolio |
| 2 | Prod Fall smoke | 1 | Catch deploy/env gaps before more UI |
| 3 | README eval narrative | 1 | Tiny; high interview signal; no dep on UX work |
| 4 | Cross-year frost test | 1 | **Blocks safe default-season** — if p10/p50 split years, heuristic lies |
| 5 | Demo GIF | 2 | Visual proof after prod is real |
| 6 | Frost-aware default + a11y | 2, 4 | Climate→UX join; a11y cheap if bundled here |
| 7 | Variety DTM honesty | 1 only | Orthogonal to seasons; trust > more crops |
| 8 | Season share/print/list | 1 (better after 6) | Completes “one plan = one season” after default feels right |
| 9 | Fall catalog depth | 1 (better after 6) | More crops matter more once Fall is the smart default |
| 10 | Fallback thicken | 1 | 99.7% climate fill; lowest urgency |

### Do not reorder into

- **Default season before cross-year test** — builds product logic on calendar edge bugs  
- **Catalog before variety honesty** — more rows without provenance weakens the trust story  
- **Fallbacks early** — polish for 0.3% before the eval narrative and default season is wrong ROI  
- **Summer / OIDC / GDD anywhere in this list** — defer

## What already reads senior

| Signal | Evidence |
|--------|----------|
| Hard domain boundary | ADR 001/004/006 — frost-first, explicit non-goals |
| Real data pipeline | GHCN nearest-station, percentiles, drift + golden eval |
| Prod ops | Neon, smoke, rate limits, threat model, OpenAPI |
| Correctness under pressure | Fall risk inversion, monotonic percentiles, season persistence |
| Tasteful scope | No GDD / succession optimizer / OIDC theater |

## Feature notes (by order slot)

### 1–2. Merge + prod smoke
- `smoke:prod` after deploy; manual Fall ZIP `55423` save/reload
- *Why:* unfinished PR ≠ portfolio

### 3. Eval narrative in README
- Golden ZIPs = climate eval set; spring+fall tolerances; link `check-golden-climate`
- *Why:* “eval harness” > “JSON fixture”

### 4. Cross-year frost percentile test
- When reference is after p10 but before p50, planning year stays coherent
- *Why:* found a real calendar edge; unblocks #6

### 5. Demo GIF Fall beat
- Season toggle → first fall frost → fall sow
- *Why:* 10-second portfolio proof

### 6. Frost-aware default season — [gap-06](./gap-06-default-season-heuristic.md)
- After ZIP resolve: next actionable season from last/first frost + today
- Manual override; unit-test flip table on golden ZIPs
- Bundle SeasonPicker label/keyboard/mobile checks
- *Why:* joins climate model to UX

### 7. Variety timing honesty — [variety-timing.md](./variety-timing.md) A–B
- Harvest Δ test; DTM outlier audit; show DTM + `sourceUrl`
- No mass sow offsets
- *Why:* data provenance

### 8. Season in share/print/list
- ICS/export titles; plan list Spring/Fall chip (no card chrome)
- *Why:* product rule completion

### 9. Fall catalog depth — [gap-05](./gap-05-catalog-fall-coverage.md)
- ~40–50 crops, cited offsets
- *Why:* domain craft after Fall default is smart

### 10. Thicken fall fallbacks — [gap-08](./gap-08-fall-fallback-fixtures.md)
- Zone/regional medians from climate aggregates
- *Why:* defense for missing climate rows

## Explicitly defer

| Item | Why defer |
|------|-----------|
| Summer season | Little new systems story until midsummer ADR |
| OIDC | Commodity; ADR 005 enough |
| Soil temp / GDD | ADR 004 non-goal |
| Baker Creek scrape | SPA stub |
| Redesign theater | Don’t purple-gradient it |

## After polish (queued)

| Item | Plan | Why after 1–10 |
|------|------|----------------|
| Native plants by ZIP | [native-plants-by-zip.md](./native-plants-by-zip.md) | Needs ADR 007 (ecoregion ≠ zone); reuses frost sow model; don’t dilute veg Fall polish |

## Interview talking points

1. Fallback chain: climate → station → regional → zone  
2. Risk inversion for first vs last frost  
3. ETL `--refetch-missing-fall` (cache looked done, wasn’t)  
4. Eval gates: golden ZIPs + monotonic percentile CI  
5. What we refused: succession optimizer, GDD, multi-season mega-plans  

## Definition of “portfolio ready”

- [x] #18 merged; prod Fall smoked  
- [x] Cross-year frost test green  
- [x] Frost-aware default season + tests  
- [x] README eval narrative  
- [x] Variety DTM visible + outlier audit in CI  
- [x] Demo GIF shows Fall once  
- [x] Explain ADRs 003/004/006 + fall cache incident in 3 minutes  
- [x] Fall catalog ≥40 crops + thickened fall fallbacks  

