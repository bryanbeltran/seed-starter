# Audit: native plants by ZIP plan

**Date:** 2026-07-19  
**Audited:** `docs/plans/native-plants-by-zip.md` vs codebase  
**PR:** [#25](https://github.com/bryanbeltran/seed-starter/pull/25)

## Verdict

**Executable with amendments — not a rewrite.** Architecture fits the repo (parallel `src/natives/`, frost reuse, precomputed ZIP→ecoregion). Gaps are precision: pilot-scope contradiction, risk-profile stance, stratification semantics, centroid ETL notes, golden-eval confusion with frost ±14d.

**Status was overstated.** “Ready to build” → **Executable after amendments + ADR 007.** Do not start Phase 2 species curation until ADR locks licenses + pilot list.

---

## Cross-cutting

| Topic | Finding | Severity |
|-------|---------|----------|
| ZIP→location today | `resolveLocation` = zone only. Centroids in gitignored `zctaCentroids.json` (climate ETL). No ecoregion field. | OK — plan join is additive |
| Bundle size | `zipClimate` 14MB already. Separate `zip-ecoregion.json` ~0.4MB est. Realistic. **Do not** mutate zipClimate. | amend |
| Spatial libs | None at runtime. PIP = ETL-only. | amend (pin) |
| ADR 004 | Frost-first / no GDD aligned. Silent p50-only = soft conflict with risk profiles. | should-fix |
| ADR 006 | Fall natives in Phase 5 = fine. Don’t invent GardenSeason for natives v1. | OK |
| ADR 001 | Parallel domain module = aligned. | OK |
| LocationForm reuse | Coupled to schedule season preview. Natives need own ZIP form; share `isValidZip` only. | amend |
| OpenAPI | `/api/location` undocumented today — natives should still ship OpenAPI entry. | note |
| Saved plans defer | OK if `?zip=` deep-link + copy doesn’t promise save. | OK |

---

## Section-by-section

| Section | Quality | Gaps |
|---------|---------|------|
| Goal / story | Strong | — |
| Decisions | Sound except #5 | Fights Phase 2 “if ready” + Acceptance (51 only) |
| Data model | Good | Stratification flag vs “early window” test undefined; pin separate zip-ecoregion file |
| Resolver sketch | Correct | Wire climate repo like location route |
| Pilot geography | Half-locked | Arid contrast undecided — not Phase 1 blocker; is v1-scope ambiguity |
| Phase 0 | Required | Must lock: pilots, risk stance, licenses |
| Phase 1 | Buildable | Document centroid fetch; golden = **exact ecoregionId**, not ±14d |
| Phase 2 | Needs clarity | Risk, stratification, contrast required vs optional |
| Phase 3 | Good | `apiRoute` limit 120; optional `?risk=`; OpenAPI |
| Phase 4 | Good | Header+footer; own form; light e2e |
| Phase 5 | Fine | — |
| Risks | Incomplete | License understated as Phase 2 gate |

---

## Gaps (detail)

1. **Pilot contradiction** — Decision 5 says 2×≥15; Phase 2 softens; Acceptance requires only 51. Pick A or B before v1 ship.
2. **Risk profile** — Veg planner maps conservative/balanced/aggressive → p90/p50/p10. Natives API sketch is p50-only. Either add `?riskProfile=` (default balanced) or ADR-explicit “natives v1 = p50 only.”
3. **Stratification** — Boolean + test (“early outdoor window”) with no `stratificationDays` / rule. Define date math or “flag + copy only.”
4. **Golden eval mix-up** — Frost golden uses ±14d. Ecoregion golden = exact ID match. Reuse ZIP keys from `data/golden-zips.json`; new expected ids.
5. **Centroids gitignored** — Phase 1 ETL must `--fetch-centroids` (or cache) before polygon join; ship only `zip-ecoregion.json`.
6. **License vagueness** — Fine for Phase 1 (geometry). Block Phase 2 until ADR names allowed floras / redistribution.
7. **UI coupling** — Don’t reuse `LocationForm` as-is (season-coupled).

---

## Amendments (apply to plan)

1. Status → **Executable with amendments**; ADR 007 first.
2. **Pilot scope (pick one):**
   - **A (recommend):** v1 ship = ecoregion **51 only** (≥15 plants). Contrast L3 = Phase 5 (or soft stretch goal).
   - **B:** ADR locks second L3 + ≥15 before calling v1 done.
3. **Risk:** ADR + API — `riskProfile` query default `balanced`, **or** explicit p50-only non-goal.
4. **Stratification:** Prefer `stratificationDays?: number` (days before last frost for outdoor sow) **or** flag-only with no date-shift test.
5. **Golden:** Exact `ecoregionId` ≥90%; reuse frost golden ZIP list; never ±14d for ecoregion.
6. **ETL:** Document gitignored centroids + fetch step; output `data/natives/zip-ecoregion.json` only; no zipClimate mutation; PIP ETL-only.
7. **API checklist:** `apiRoute("natives", …, { limit: 120 })`, OpenAPI, 400/429, `catalogCoverage`.
8. **UI checklist:** `AppHeader` + `AppFooter` link; dedicated ZIP form; `?zip=` deep-link.
9. **Licenses:** ADR 007 lists allowed sources before Phase 2 curation.

---

## Recommended build order (unchanged spine)

```text
Amend plan → Phase 0 ADR 007 → Phase 1 join+golden → Phase 2 catalog+resolver
  → Phase 3 API → Phase 4 UI → Phase 5 expand
```

Do **not** block Phase 1 on arid pick or species licenses.

---

## Acceptance for “plan audit done”

- [x] Verdict recorded
- [x] Amendments listed
- [x] Amendments folded into `native-plants-by-zip.md`
