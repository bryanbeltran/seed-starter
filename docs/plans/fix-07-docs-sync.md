# Fix 7: Docs sync (fall plan + ADR index)

**Severity:** Should-fix (docs only)  
**Status:** Ready to build  

## Problem
- `docs/plans/fall-season.md` still says **Ready to build** with unchecked acceptance
- README ADR table stops at 005 — no link to ADR 006
- Gap/fix plan index may not list audit fixes

## Plan
1. Update `fall-season.md`:
   - Status: **Implemented** (note persistence fixes 1–2 if still open at write time)
   - Check acceptance boxes that are true; leave persistence unchecked until 1–2 land
2. README Architecture ADR table: add `[006](docs/adrs/006-multi-season-frost.md)` multi-season frost
3. `docs/plans/README.md`: add **Audit fixes** section linking fix-01…fix-07
4. Optionally mark gap-07 done (already done) — no change needed if accurate

## Acceptance
- [ ] fall-season.md matches reality
- [ ] README links ADR 006
- [ ] Plans index lists fix-01…07

## Files
`docs/plans/fall-season.md`, `docs/plans/README.md`, `README.md`
