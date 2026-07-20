# Polish 03: README climate eval narrative

**Roadmap slot:** 3  
**Status:** Ready (amended after plan audit)  
**Depends on:** [polish-01](./polish-01-merge-fall-pr.md); prefer after [polish-02](./polish-02-prod-fall-smoke.md) so README doesn’t over-claim prod Fall  
**Effort:** small docs PR  
**Audit:** [polish-01-03-audit.md](./polish-01-03-audit.md)

## Goal
Make the golden-ZIP / climate gate read as an **eval harness** in the README — interview signal, not “we have a JSON file.”

## Content (Climate eval section)

Place after Architecture / Failure modes (before Setup).

Must include:
1. **What:** ~50 golden ZIPs; spring `lastFrostP50` + fall `firstFallFrostP50` within **±14 days**
2. **Why:** GHCN nearest-station ETL can drift; eval catches silent regressions
3. **How:** `pnpm run check` runs `check-golden-climate.mjs` and `check-climate-drift.mjs` (coverage, distance, **monotonic** p10≤p50≤p90)

Do **not** put risk-inversion / ADR 006 product semantics in this section — link ADR 006 from Features or Architecture only.

Suggested table (climate-focused):

| Gate | Script | Signal |
|------|--------|--------|
| Golden ZIPs | `scripts/check-golden-climate.mjs` | Spring + fall p50 ±14d |
| Climate drift | `scripts/check-climate-drift.mjs` | Coverage, distance, monotonic percentiles |

Optional one line under table: crop timing audited separately via `audit-timing.mjs` (not climate eval).

Tone: factual. No “FAANG” / marketing language.

## Steps
1. After 01 (+ preferably 02): branch `cursor/readme-climate-eval-3c56` from `main`.
2. Edit `README.md` (optional pointer in `docs/data-sources.md`).
3. Link `data/golden-zips.json`, `docs/adrs/003-climate-nearest-station.md` (and ADR 006 only from Architecture if desired).
4. Open small PR → merge.

## Out of scope
- Changing golden set or tolerances
- New CI jobs
- Methodology essay (ADRs hold depth)
- Extending smoke.mjs (polish-02 follow-up)

## Acceptance
- [x] README has Climate eval section
- [x] States ±14d, spring + fall, `pnpm run check`
- [x] Links golden data and/or ADR 003
- [x] Merged to `main`

## Draft sketch

```markdown
## Climate eval

Schedules are only as good as the frost model. We keep ~50 golden US ZIPs with
expected last-spring-frost and first-fall-frost p50 dates. \`pnpm run check\`
runs \`check-golden-climate\` (±14 day band) and \`check-climate-drift\`
(coverage, station distance, monotonic percentiles). When GHCN ETL changes
stations or summaries, eval failures mean fix the model — not the UI.

See [\`data/golden-zips.json\`](data/golden-zips.json) and
[ADR 003](docs/adrs/003-climate-nearest-station.md).
```
