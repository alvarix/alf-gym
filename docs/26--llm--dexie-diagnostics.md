# 26 — Dexie diagnostics — LLM spec

**Estimated effort:** 1–2 hours (first slice).

First-slice scope: mechanical sweep of remaining `.where()` calls in `app.js`. Defer the regression test, the DB-reopen investigation, and the double-fire root-cause until a real failure resurfaces.

Companion: `docs/26--usr--dexie-diagnostics.md`. Source: `docs/22-postmortem-import-load.md`.

## Goal

Eliminate the class of silent failures where imported rows are present in IndexedDB but Dexie `.where()` returns empty. Backup-restore is the cross-device sync stopgap until pocketbase lands, so trust in it is load-bearing.

## Architecture baseline (verified)

- `Grep -c '\.where(' app/app.js` → 23 calls
- r4.7 converted three on-import-load paths to `toArray() + filter`
- Remaining ~20 calls span: prescription reads, set reads, pain mark reads, wishlist, trackers, builder flows
- The fix pattern is one-to-one: replace `db.t.where({ k: v }).toArray()` with `(await db.t.toArray()).filter(r => r.k === v)`. No semantic change at current data scale (~50 performances, ~150 sets).

## Plan (first slice only)

| # | Item | Effort | Risk |
|---|------|--------|------|
| D1 | Mechanical `.where()` sweep | 1–2h | low — defensive, no behaviour change |

Process:
1. List all 23 `.where()` callsites
2. Skip the 3 already converted (in `openSession`, `startSessionForDay`, prefill)
3. Convert each remaining site, batched by neighbourhood (builder reads, session-end reads, wishlist/tracker reads, etc.)
4. Run `npx playwright test` after each batch — must stay 33/33
5. Add inline `// see r4.7 postmortem` comments at converted sites

## Deferred to future iterations

- **D2** (backup → import regression test): worth doing eventually, not blocking. Build only after a failure reappears or before pocketbase migration begins.
- **D3** (`applyBackupReplace` DB reopen): root-cause fix would obsolete D1. Investigate only if D1's defensive pattern starts feeling expensive (data growth, perceptible UI lag).
- **D4** (`openSession` double-fire): the in-flight guard works. Origin is unknown but harmless. Investigate only if guard ever fails.

## Open questions

1. Do we want a single utility helper (`scanFilter(table, predicate)`) instead of inlining the pattern 20×? — Probably yes; it's grep-friendly and gives a single place to revert if Dexie ever fixes the underlying bug. Decide before sweeping.
