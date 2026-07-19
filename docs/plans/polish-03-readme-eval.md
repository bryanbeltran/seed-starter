# Polish 03: README climate eval narrative

**Roadmap slot:** 3  
**Status:** Ready  
**Depends on:** [polish-01](./polish-01-merge-fall-pr.md) preferred (so links/paths match `main`)  
**Can start:** draft on branch anytime; merge to `main` after #18  
**Effort:** small docs PR

## Goal
Make the golden-ZIP / climate gate read as an **eval harness** in the README — interview signal, not “we have a JSON file.”

## Content to add (3–6 sentences + tiny table)

Place after Architecture / Failure modes (or under a new **Climate eval** heading before Setup):

1. **What:** ~50 golden ZIPs assert spring `lastFrostP50` (and fall `firstFallFrostP50`) within ±N days of expected bands.
2. **Why:** nearest-station GHCN model can drift when ETL/stations change; eval catches silent regressions.
3. **How:** `pnpm run check` → `scripts/check-golden-climate.mjs` (+ drift / monotonic percentile checks).
4. **Fall:** same harness extended after first-fall-frost regen; risk profiles map inverted percentiles (link ADR 006).

Suggested table:

| Gate | Script | Signal |
|------|--------|--------|
| Golden ZIPs | `check-golden-climate.mjs` | Spring + fall p50 bands |
| Climate drift | `check-climate-drift.mjs` | Coverage, distance, monotonic p10≤p50≤p90 |
| Timing audit | `audit-timing.mjs` | Crop offset sanity |

Keep tone factual. No “FAANG” / marketing language in README.

## Steps
1. Branch from `main` (after merge): `cursor/readme-climate-eval-3c56` (or continue on fall branch pre-merge if #18 still open — rebase after).
2. Edit `README.md` only (optional one-line in `docs/data-sources.md` pointing to golden file).
3. Verify links: `data/golden-zips.json`, `docs/adrs/003-climate-nearest-station.md`, `docs/adrs/006-multi-season-frost.md`.
4. `pnpm run check` still green (docs-only should be).
5. Open small PR → merge.

## Out of scope
- Changing golden tolerances or ZIP set
- New CI jobs
- Long methodology essay (keep ADRs for depth)

## Acceptance
- [ ] README has a Climate eval (or equivalent) section
- [ ] Mentions spring + fall golden checks and `pnpm run check`
- [ ] Links to golden data and/or ADR 003/006
- [ ] Merged to `main`

## Draft sketch (edit freely)

```markdown
## Climate eval

Schedules are only as good as the frost model. We keep a golden set of ~50 US ZIPs
with expected last-spring-frost and first-fall-frost p50 dates. CI runs
\`check-golden-climate\` (±14 day band) plus drift checks (coverage, station
distance, monotonic percentiles). When GHCN ETL changes stations or summaries,
eval failures mean fix the model — not the UI.
```
