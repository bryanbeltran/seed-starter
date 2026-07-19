# Audit of fix plans 01–07

**Date:** 2026-07-19  
**Audited:** `fix-01` … `fix-07` against code + prior quality audit

## Verdict

Plans are **buildable and correctly targeted**. Ship **01+02 together** (same merge gate). Order: **01→02→05→04→03→06→07** (or 03 anytime after summaries exist; 07 last).

No plan is wrong enough to rewrite. Apply the amendments below before coding.

## Plan-by-plan

| Plan | Verdict | Amendments |
|------|---------|------------|
| **01 Postgres season** | Solid | Explicitly: `planFromRow` must read DB `season` or **update** `existing.season` stays wrong even after create fix. Add assert on `listSavedPlans` too. |
| **02 SQLite update** | Solid | Ship with 01. Require **getSavedPlan after update** in test (already said). Also put `season` on update return stub (said). |
| **03 Percentile order** | Solid | Confirm rebuild = `etl:climate --full --write` **without** refetch. Prefer DOY sort + clamp. Add drift check. Note: string sort of zero-padded `MM-DD` is already chronological — DOY still safer. |
| **04 Transplant order** | Good / tweak | Prefer clamp **B** (move indoor earlier to preserve harden window), not A (zero harden). Mention UI may already sort by date — still fix emit dates. |
| **05 API crop guard** | Solid | Also guard **saved-plans create/patch** (same invalid crop+season). Fail closed in `buildSchedule` so compare path is covered. |
| **06 Default season** | OK / product | “Always spring” is right MVP; conflicts with gap-06 intentional Jul heuristic — gap-06 stays follow-up. Note sessionStorage restore must still override (already true). |
| **07 Docs sync** | Solid | Land **after** 01–02 so fall-season acceptance boxes aren’t a lie. Link fix plans from index (this audit). |

## Cross-cutting gaps in the plan set

1. **01/02 coupling** — Not optional. Postgres `planFromRow` bug breaks update’s `existing.season` on both backends once season is in DB.
2. **Year-split percentiles** (p10 rolls to next year, p50 stays this year) — called out in quality audit, **not** in 01–07. Accept as residual or add fix-08 later; not blocking these plans.
3. **Catalog fall offset sanity** (fix-04 optional audit) — don’t block merge; file under gap-05 if defaults are wrong.
4. **No rollback plan** for zipClimate regen in 03 — low risk (deterministic from summaries); note in PR.

## Suggested implementation slices

| Slice | Plans | Why |
|-------|-------|-----|
| A | 01 + 02 + tests | Unblocks merge |
| B | 05 | API honesty; small |
| C | 04 | Timeline correctness |
| D | 03 + zipClimate rebuild + drift check | Data integrity |
| E | 06 + 07 | UX default + docs |

## Acceptance for “plans done”

- [x] Each of 1–7 has problem, steps, files, acceptance
- [x] Blockers called out with prod impact
- [x] Meta-audit recorded (this file)
- [ ] Amendments applied during implementation (not before)
