# Polish 01: Merge fall PR #18

**Roadmap slot:** 1  
**Status:** Ready (amended after plan audit)  
**PR:** https://github.com/bryanbeltran/seed-starter/pull/18  
**Branch:** `cursor/fall-season-3c56` → `main`  
**Audit:** [polish-01-03-audit.md](./polish-01-03-audit.md)

## Goal
Land fall season + climate regen + audit fixes on `main` so prod and portfolio reflect the work.

## Preconditions
- [ ] GitHub check rollup on **remote** HEAD is green (`check` + `postgres` SUCCESS) — not merely `mergeable`
- [ ] Vercel preview deploy SUCCESS for that commit
- [ ] PR undrafted / ready to merge
- [ ] No open blocker review comments
- [ ] Ignore local untracked noise (`.agents/`); only remote branch matters

## Steps
1. Wait until `gh pr checks 18` (or UI) shows all required checks green on latest commit.
2. Skim final diff once: season persistence, `UnsupportedSeasonCropError`, climate data present.
3. Merge with a **merge commit** (match prior repo history; keep fall/climate commit narrative). Avoid squash.
4. Confirm:
   ```bash
   git fetch origin main
   git log -1 --oneline origin/main
   # fall frost present on main:
   git grep -l firstFallFrostP50 origin/main -- data/zipClimate.json
   git show origin/main:docs/adrs/006-multi-season-frost.md | head -5
   ```
5. Confirm Vercel production deploy for `main` starts.
6. Hand off to [polish-02](./polish-02-prod-fall-smoke.md). No new features until smoke passes.

## Out of scope
- Demo GIF (slot 5)
- Frost-aware default season (slot 6)
- Further commits on the fall branch after merge (unless hotfix)

## Acceptance
- [ ] PR #18 state = MERGED
- [ ] `origin/main` has ADR 006 + `firstFallFrostP50` in zipClimate
- [ ] Production deploy queued/succeeded
- [ ] Ready for polish-02

## Rollback
1. `git revert -m 1 <merge_commit>` on `main` (or GitHub revert).
2. Wait for deploy; `health.commit` should leave the fall SHA.
3. Hotfix on a new `cursor/…` branch from the reverted `main`; do not pile polish on a broken deploy.
