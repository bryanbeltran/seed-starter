# Polish 01: Merge fall PR #18

**Roadmap slot:** 1  
**Status:** Ready  
**PR:** https://github.com/bryanbeltran/seed-starter/pull/18  
**Branch:** `cursor/fall-season-3c56` → `main`

## Goal
Land fall season + climate regen + audit fixes on `main` so prod and portfolio reflect the work.

## Preconditions
- [ ] CI `check` green on latest commit
- [ ] CI `postgres` green (or known skip)
- [ ] Vercel preview healthy
- [ ] Working tree clean on branch (or only intentional docs)
- [ ] No open blocker comments

## Steps
1. Wait for in-flight CI on HEAD to finish green.
2. Skim final diff once: season persistence, `UnsupportedSeasonCropError`, zipClimate size OK.
3. Merge PR #18 into `main` (GitHub UI merge or squash — match repo norm; prior PRs used merge commits).
4. Confirm `main` HEAD includes fall commits: `git fetch origin main && git log -1 --oneline origin/main`.
5. Confirm Vercel production deploy starts for `main`.
6. Hand off immediately to [polish-02](./polish-02-prod-fall-smoke.md) — do not start new features until smoke passes.

## Out of scope
- Demo GIF (slot 5)
- Frost-aware default season (slot 6)
- Any follow-up code on the fall branch after merge

## Acceptance
- [ ] PR #18 state = MERGED
- [ ] `origin/main` contains ADR 006 + `seasons.fall` + `firstFallFrostP*` in zipClimate
- [ ] Production deploy queued/succeeded (Vercel)
- [ ] Ready for prod smoke (plan 02)

## Rollback
If prod smoke fails hard: revert merge commit on `main` or hotfix; do not pile polish on a broken deploy.
