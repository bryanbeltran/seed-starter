# Gap 4: PR merge / plans on main

**Status:** Done (plans + ADR on fall branch; supersedes #17)  

## Gap
- Plans PR #17 open — `docs/plans/*` not on `main`
- Fall PR #18 links to missing plan path
- ADR 006 still lists catalog/UI as non-goals (stale)

## Plan
1. Land `docs/plans/` onto fall branch (cherry-pick #17 or copy).
2. Add gap plans 01–08 under `docs/plans/`.
3. Refresh ADR 006 Consequences (catalog/UI/ETL shipped; regen = data job).
4. Merge plans into fall PR #18 body; merge #17 to main when green (or supersede by including plans in #18).
5. Keep #18 as single ship vehicle if #17 unmerged.

## Acceptance
- [x] `docs/plans/` present on fall branch (includes product + gap plans)
- [x] ADR 006 matches shipped reality
- [x] Fall PR #18 carries plans (supersedes #17)
