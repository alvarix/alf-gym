# Postmortem: imported sessions and new sessions both showed empty

## 2026-05-15

Closes the thread started in docs/20 (import) and docs/21 (session load).

## Symptoms

After importing a backup JSON via the restore flow:
1. Opening session 5 (the most recent imported session) showed no exercises despite the backup containing 17 performances and 123 sets.
2. Other past sessions intermittently rendered, then disappeared.
3. Starting a brand-new session from any day produced a session row with no performances.
4. Eventually an Alpine error: `Cannot read properties of undefined (reading 'after')` from `sessionGroupedBlocks()`.

## Three independent bugs, stacked

### 1. Dexie secondary indexes are unreliable after `bulkPut` on imported rows

`applyBackupReplace()` does `db[name].clear()` then `db[name].bulkPut(rows)` inside a transaction. After this completes, queries like:

```js
db.performances.where('sessionId').equals(5).toArray()   // → []
db.performances.where({ sessionId: 5 }).toArray()        // → []
db.blocks.where({ dayId: 23 }).toArray()                 // → []
```

returned empty arrays, even though the rows were physically in the table (confirmed via `toArray()` returning all 53 performances with the correct numeric `sessionId` values).

The bug compounded because `startSessionForDay()` used the same `where()` pattern to look up blocks and prescriptions for the chosen day. When those tables had been overwritten by import, the inner loop iterated zero times and the new session was created without any performances.

**Workaround applied.** Two query sites were converted to full-scan + in-memory filter:
- `openSession()` — performances, sets, painMarks
- `startSessionForDay()` — blocks, prescriptions, and the prefill lookups for previous performances and sets

```js
const all = await db.performances.toArray();
const perfs = all.filter(p => p.sessionId === id);
```

This bypasses Dexie's index machinery entirely. Performance is acceptable at the current data scale (~50 performances total, ~150 sets).

**Not yet root-caused.** It is still unclear *why* the indexes don't match. Hypotheses ruled out: type coercion (numeric ids are stored as numbers, confirmed via `JSON.stringify` of unique sessionIds returning bare integers), Alpine proxy contamination (`parseInt` produces a primitive). Hypothesis still on the table: Dexie's index cursors are built lazily and don't notice rows added in a foreign transaction context, or the `bulkPut` skips index emission for tables that were just `clear()`ed in the same transaction. There are ~20 other `.where(...)` calls in `app.js` that may also be affected.

### 2. `openSession()` fired twice for every navigation

Diagnostic logging showed two distinct `callId`s arriving within the same millisecond for every session open. Origin not yet identified — only one `hashchange` listener is registered in `init()`, only one `x-data` on the root element, and `gotoHash()` uses the standard "set hash, let the event fire" pattern.

Without a guard, the second call would race the first: both would `await` the same async chain, the second would finish slightly later, and whichever happened to land last would clobber `activeSessionPerformances`. This is the most plausible explanation for the "intermittent" symptom.

**Workaround applied.** Added an in-flight token at the top of `openSession()`:

```js
if (this._openSessionInFlight === id) return;
this._openSessionInFlight = id;
try { ... } finally {
  if (this._openSessionInFlight === id) this._openSessionInFlight = null;
}
```

The second call now logs `skipped — already loading id=X` and returns immediately.

**Not yet root-caused.** Why the double-fire happens at all is unknown. Could be Alpine reactivity re-triggering on view change, or a browser-level quirk with `location.hash` assignment dispatching the event twice. The guard makes it irrelevant in practice.

### 3. `sessionGroupedBlocks()` produced duplicate `:key` values for Alpine

Once session 5 was actually loading data, Alpine threw `Cannot read properties of undefined (reading 'after')`. This is Alpine's internal x-for/DOM-positioning error, and the immediate cause was duplicate `:key="g.blockId"` values in the groups list.

`sessionGroupedBlocks()` walks performances in `.order` and starts a new group whenever `blockId` changes. If performances within a single block are not contiguous in `.order` (which can happen after mid-session edits — adding an exercise late assigns a higher order, putting it after another block's rows), the same `blockId` can appear in more than one group, producing duplicate keys.

**Workaround applied.** Each group now carries a unique `key` field combining its position and blockId, and the template uses `:key="g.key"`:

```js
last = { key: groups.length + '_' + p.blockId, blockId: p.blockId, ... };
```

This is also a sturdier long-term solution: the visual grouping no longer depends on blockId being unique across groups.

## What we changed

- `app/app.js` `openSession()` — full-scan + filter for performances/sets/painMarks; in-flight guard; diagnostic `console.log`s (kept for now).
- `app/app.js` `startSessionForDay()` — full-scan + filter for blocks/prescriptions/prev-session lookups; diagnostic logs.
- `app/app.js` `sessionGroupedBlocks()` — stamps a unique `key` per group.
- `app/index.html` session view — `:key="g.key"` instead of `:key="g.blockId"`.

## What we didn't change yet (deliberately)

- The other ~20 `.where(...)` calls scattered across `app.js`. They may or may not be hitting the same Dexie-after-import problem. The plan is to leave them until we either reproduce a concrete failure or root-cause the index issue.
- Console diagnostic logs are still in place. Remove them once we're confident the workarounds hold across more sessions and more imports.
- The double-fire root cause. The guard is sufficient.

## Lessons

- "It's in the database but the query returns nothing" almost always points at index state, not data shape. Verifying the data with `toArray()` first (rather than the same `where()` that's failing) saved us from chasing type-coercion ghosts.
- Diagnostic logging with unique per-call ids was what turned an intermittent symptom into a deterministic one — without `callId`s in the log we'd have kept guessing about whether the same call was completing twice or two calls were racing.
- Three independent bugs presented as one symptom ("sessions are empty"). Each fix uncovered the next. The temptation to declare the first fix sufficient was strong; the user testing each iteration is what kept us honest.

## Follow-ups

- [ ] Decide on a sweep of remaining `where()` calls or a root-cause investigation of Dexie indexes after `bulkPut`.
- [ ] Remove diagnostic `console.log`s after a few sessions of confidence.
- [ ] Consider whether `applyBackupReplace()` should do something post-bulkPut to force index rebuild (close and reopen the database, perhaps).
- [ ] Investigate the `openSession` double-fire origin if it ever shows up elsewhere.
