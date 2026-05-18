# 26 — Dexie diagnostics — Tasks

**Estimated effort:** 1–2 hours (first slice only: mechanical `.where()` sweep).

Follow-up from `docs/22-postmortem-import-load.md`. The r4.7 incident showed Dexie secondary indexes return empty after `bulkPut` on imported rows. Three read paths were converted to `toArray() + filter`. ~20 other `.where()` calls remain — same code shape, same exposure.

## Tasks (first slice)
- [ ] Audit the remaining ~20 `.where(...)` calls in `app.js` (`Grep -c '\.where(' app/app.js` reports 23 total; 3 already converted in r4.7)
- [ ] For each call, convert to `toArray() + filter` — pattern is identical to the r4.7 fixes (`openSession`, `startSessionForDay`)
- [ ] Run the full playwright suite after each batch
- [ ] Add a one-line comment at each converted site referencing r4.7 (`// see r4.7 postmortem`) so future readers don't "optimise" them back to `.where()`

## Decisions needed
- [ ] Adopt full-scan + filter globally as the project convention (acceptable at current data scale ~50 performances / ~150 sets; revisit if scale grows 100×)

## Deferred (do not pick up unless a failure resurfaces)
- D2 — backup → import → exercise-every-read-path regression test
- D3 — `applyBackupReplace` close-and-reopen-the-DB to force index rebuild
- D4 — `openSession` double-fire root cause (in-flight guard already sidesteps it)

## Ruled out
- Switching off Dexie entirely (pocketbase migration is the long-term answer)

## Feedback
(fill in after sweep)
