# Audit: polish plans 01–03

**Date:** 2026-07-19  
**Audited:** merge, prod Fall smoke, README eval

## Verdict

**Executable with amendments.** Sequencing (merge → smoke → README) is sound. Gaps are mostly precision (CI wait, location field naming, merge strategy, smoke automation follow-up)—not wrong architecture.

**Ship plans after applying amendments below** (already folded into the three plan files where noted).

---

## Cross-cutting

| Topic | Finding | Severity |
|-------|---------|----------|
| Order 01→02→03 | Correct. Smoke must gate on deployed `main`. README can draft earlier but merge after smoke unless folded into #18 | OK |
| Fold README into #18? | Optional optimization: land polish-03 on fall branch pre-merge → one deploy. Separate PR after merge is cleaner for review. Either OK; prefer **after smoke** so README doesn’t claim prod Fall before verified | nice |
| Automation debt | Fall curls are one-off; lasting design is extend `scripts/smoke.mjs` + `smoke-prod.yml`. Correctly deferred for slot 2, but should be explicit follow-up | should-fix (plan note) |

---

## Plan 01 — Merge #18

| | |
|--|--|
| **Quality** | Clear goal, acceptance, handoff to 02 |
| **Completeness** | Missing CI-wait semantics; merge strategy vague; local dirt vs remote HEAD |
| **Design** | Rollback mentioned but thin |

### Gaps
1. **CI:** `mergeable: MERGEABLE` ≠ safe. Wait until check rollup **SUCCESS** (status was UNSTABLE while check in progress).
2. **Merge method:** Pin **merge commit** (repo history uses merges). Avoid squash — loses fall/climate commit narrative for portfolio.
3. **Preconditions:** Verify **remote** HEAD CI, not local untracked `.agents/`.
4. **Confirm contents:** `git show origin/main:data/zipClimate.json | head` useless (one line); better: `node -e` count `firstFallFrostP50` after pull, or `git grep firstFallFrostP50 origin/main -- data/zipClimate.json`.
5. **Draft PR:** Undraft / ready-for-review if still draft before merge.
6. **Rollback:** Add “revert merge commit; confirm health.commit rolls back; re-open hotfix branch.”

### Amendments applied
- Wait for green check rollup; prefer merge commit; remote-HEAD focus; sharper verify commands; rollback steps.

---

## Plan 02 — Prod Fall smoke

| | |
|--|--|
| **Quality** | Strong curl + UI matrix; failure table useful |
| **Completeness** | Location expectation slightly wrong; deploy-ready gate OK via health.commit |
| **Design** | Good use of existing smoke + additive fall probes |

### Gaps
1. **Location API naming:** Response always uses `lastFrostP50` for the season anchor—even in fall. Expect `season:"fall"`, `frostSource:"climate"`, autumn `lastFrostP50` date—not a field named `firstFallFrost`.
2. **Auth:** Prod has owner-cookie; browser save sets cookie via `requireOwnerId` — UI path OK. Note: bare curl create without cookie may still work (`ownerId` null). No change required for UI steps.
3. **Deploy lag:** Add explicit loop: poll health until `commit` matches `main` (max ~10 min) before fail.
4. **Direct-sow check:** Optional carrot `fall_sow` assert — lettuce only covers transplant path. Add one curl for carrot.
5. **Follow-up:** “Extend `smoke.mjs` with fall case” as slot-2 exit note (CI forever).
6. **Polish-03 gate:** Docs can proceed if only cosmetic UI flake; API/climate failures block.

### Amendments applied
- Location field clarification; commit poll; carrot `fall_sow` curl; smoke.mjs follow-up; blocker vs non-blocker for 03.

---

## Plan 03 — README eval

| | |
|--|--|
| **Quality** | Right tone constraints; good draft |
| **Completeness** | Draft ≠ full content checklist; ±N vs ±14 |
| **Design** | Mixing risk-inversion into “eval” dilutes harness story |

### Gaps
1. **Scope creep in bullets:** ADR 006 risk inversion is product semantics—link from Features/ADR, not inside Climate eval.
2. **Tolerance:** State **±14 days** (matches `golden-zips.json`), not “±N.”
3. **Timing audit table row:** Related but not climate eval—label “Related check gates” or drop.
4. **Draft vs table:** Draft sketch should include the gate table or drop table from requirements.
5. **Branching:** Prefer new branch from `main` after 01+02; avoid stuffing into #18 unless still open and smoke already green on preview.

### Amendments applied
- ±14; risk inversion out of eval section; related-gates wording; branching preference after smoke.

---

## System design scorecard

| Principle | Score | Notes |
|-----------|-------|-------|
| Fail closed before polish | Good | Smoke before README/features |
| Prod = source of truth | Good | health.commit match |
| Durable automation | Fair | Curls manual; needs smoke.mjs follow-up |
| Observability | Fair | No log/query steps; Vercel logs only on 500 |
| Honest docs | Good | No FAANG marketing in README plan |
| API contract clarity | Fair→Good | After lastFrostP50 naming note |

## Residual (don’t block 01–03)

- Rename location/schedule frost fields to season-neutral `frostAnchorP50` (later refactor)
- Year-split percentile tests (roadmap slot 4)
- Auth E2E for saved plans across browsers (cookie already implicit)
