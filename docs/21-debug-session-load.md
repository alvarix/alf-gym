# Debug: Session exercises not loading
## 2026-05-14

Continuation of docs/20. Import is now working. Session 5 (2026-05-14) still shows no exercises.

---

## What we know

- Backup confirmed: session 5 has 17 performances, 123 sets, all with correct integer `sessionId: 5`
- After import, `performances.toArray()` returns 53 records with sessionIds [2, 4, 5]
- `openSession()` is called with `id: 5` (number)

## Attempts

### 1 — `where({ sessionId: id })` returns 0
Original query. Data is in IDB, types match, but returns empty. No error thrown.

### 2 — Added diagnostic logging
Confirmed: `filter()` returns 17, `where().equals()` returns 17 — both in the same diagnostic call. Switched active query to `filter()` as temporary fix.

### 3 — Switched to `where('sessionId').equals(id)`
Cleaned up filter/diagnostic code. Used explicit Dexie `.equals()` form for performances, sets, and painMarks. Still not loading.

### 4 — Stopped here

---

## Current state of `openSession()` (app.js ~line 283)

Uses `where('sessionId').equals(id)` for performances and `where('performanceId').equals(p.id)` for sets/pains. Still returns empty in practice despite diagnostic showing 17.

## Hypotheses not yet tested

1. **Race condition / multiple calls** — console showed `openSession` firing 4 times. Last call may overwrite correct data with empty result if a concurrent call uses a stale/closed IDB transaction.
2. **Dexie index not rebuilt after bulkPut** — `where().equals()` may return 17 in a warm diagnostic context but 0 when the index cursor is opened fresh. Full scan via `toArray().filter()` bypasses the index entirely and may be the reliable workaround.
3. **Alpine proxy contaminating the `id` argument** — `activeSessionId` is reactive state; if `id` passed to `.equals(id)` is a Proxy-wrapped number rather than a primitive, the IDB index comparison may fail.

## Recommended next step

Try replacing the query with a full scan + filter as the permanent approach:
```js
const all = await window.alfdb.performances.toArray();
const perfs = all.filter(p => p.sessionId === id);
```
This is confirmed to return 17. Performance is acceptable for current data size. If it works, the index-based queries can be investigated separately.
