# FAANG polish roadmap

**Goal:** High-signal senior portfolio — domain depth, production judgment, measurable correctness. Not feature sprawl.

**State (2026-07-19):** Fall season + climate regen + audit fixes 01–07 on #18 (CI green). Merge next.

## What already reads senior

| Signal | Evidence |
|--------|----------|
| Hard domain boundary | ADR 001/004/006 — frost-first, explicit non-goals |
| Real data pipeline | GHCN nearest-station, percentiles, drift + golden eval |
| Prod ops | Neon, smoke, rate limits, threat model, OpenAPI |
| Correctness under pressure | Fall risk inversion, monotonic percentiles, season persistence |
| Tasteful scope | No GDD / succession optimizer / OIDC theater |

## Polish bets (ordered)

Ship only what raises **interview signal per hour**. Skip vanity UI and second climate models.

### P0 — Close the loop (this week)

1. **Merge #18 + prod smoke with Fall**
   - `smoke:prod` after deploy; one manual Fall ZIP (55423) save/reload
   - Screenshot/GIF: season toggle → first fall frost → fall sow
   - *Why:* unfinished PR ≠ portfolio

2. **Frost-aware default season** — [gap-06](./gap-06-default-season-heuristic.md)
   - After ZIP resolve: pick next actionable season from last/first frost + today
   - Keep manual override; unit-test flip table for golden ZIPs
   - *Why:* joins climate model to UX — rare in toy apps

3. **Eval narrative in README**
   - One short section: golden ZIPs = climate eval set; fall+spring tolerances; link `check-golden-climate`
   - *Why:* interviewers hear “eval harness,” not “JSON fixture”

### P1 — Trust & depth (next)

4. **Variety timing honesty** — [variety-timing.md](./variety-timing.md) Phases A–B
   - Assert harvest Δ; audit DTM outliers; show DTM + `sourceUrl` in UI
   - *No* mass sow offsets
   - *Why:* data provenance > more scrapers

5. **Fall catalog depth** — [gap-05](./gap-05-catalog-fall-coverage.md)
   - Target ~40–50 fall crops with cited offsets (alliums, roots, cool herbs)
   - *Why:* domain craft; UI already filters empty seasons

6. **Cross-year frost percentile test**
   - When reference date is after p10 but before p50, all percentiles share the same planning year
   - *Why:* shows you found a real calendar edge case

### P2 — Product finish (optional)

7. **Season in share/print story**
   - ICS/export titles mention season; saved-plan list shows Spring/Fall chip (non-card)
   - *Why:* completes the “one plan = one season” product rule

8. **A11y + mobile season control**
   - Season radios labeled; keyboard; mobile first paint still brand/ZIP/crops first
   - *Why:* senior ships accessible defaults without a redesign circus

9. **Thicken fall fallbacks** — [gap-08](./gap-08-fall-fallback-fixtures.md)
   - Only after climate fill; zone/regional medians from aggregates
   - *Why:* defense in depth for the 0.3% missing climate rows

### Explicitly defer (low signal)

| Item | Why defer |
|------|-----------|
| Summer season | Reuses spring frost; little new systems story until midsummer ADR |
| OIDC / multi-tenant auth | Commodity; owner-cookie + ADR 005 enough |
| Soil temp / GDD | ADR 004 non-goal; dilutes frost thesis |
| Baker Creek scrape | SPA stub; not the portfolio bet |
| Redesign / dark-mode toys | Portfolio already has product UI; don’t purple-gradient it |

## Interview talking points (keep honest)

1. **Fallback chain:** climate → station → regional → zone; confidence by station distance  
2. **Risk inversion:** same “conservative” intent; p10/p90 flip for first vs last frost  
3. **ETL force-refetch:** spring cache looked “done”; `--refetch-missing-fall` fixed silent incomplete data  
4. **Eval gates:** golden ZIPs + monotonic percentile CI check  
5. **What we refused:** succession optimizer, GDD, full-year multi-season plans

## Definition of “portfolio ready”

- [ ] #18 merged; prod Fall path smoked
- [ ] Frost-aware default season + tests
- [ ] README eval narrative (3–5 sentences)
- [ ] Variety DTM visible + outlier audit in CI
- [ ] Demo GIF shows Fall once
- [ ] Can explain ADRs 003/004/006 + one production incident (fall cache skip) in 3 minutes
