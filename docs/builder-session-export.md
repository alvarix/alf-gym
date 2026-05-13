# Builder/Session unification + Backup/Restore — implementation reference

This document captures the design and current implementation of three features shipped on master in May 2026, intended as a self-contained reference for future bug fixes and incremental work.

- **Commit 8e8a3e2** `feat(io): full IDB backup and restore with one-cycle undo` — Phase A
- **Commit 1fe2d49** `feat(session): add and remove exercises mid-session with template/fork/session scope` — Phase B.1
- **Commit 231c2ed** `feat(session): add new block mid-session with template/fork/session scope` — Phase B.2

**Phase C (in-place edit of prescriptions/blocks during a session)** was planned but **not implemented**. See "Open / not yet shipped" at the bottom.

Originating plan: `/Users/alvarsirlin/.claude/plans/opus-builder-session-export-magical-snail.md`.

---

## Glossary

| Term | Storage | Purpose |
|---|---|---|
| Workout | `workouts` table | Top-level template / programme. Versioned via `parentId` + `isCurrent`. |
| Day | `days` table | Sub-template inside a workout. `groupKey` of A/B/C. |
| Block | `blocks` table | Section inside a day. `type` is `linear` or `circuit`. Circuit-only: `rounds`, `restBetweenRoundsSec`. Has `optional` flag. |
| Prescription | `prescriptions` table | Planned exercise inside a block: `exerciseId`, `sets`, `reps`, `load`, `sideScheme`, `holdSec`, `notable`, `notes`, `order`. |
| Exercise | `exercises` table | Global library entry. Hierarchical via `parentId`. |
| Session | `sessions` table | A live or completed run-through of a Day. |
| Performance | `performances` table | Session-time **snapshot** of a Prescription. Denormalises prescription + block fields. |
| Set | `sets` table | Actual logged set inside a performance. |
| PainMark | `painMarks` table | Pain log inside a session. |

The session model is **append-only by design**: starting a session snapshots the template into Performance/Set rows. Edits to performances/sets do not flow back to templates unless the new Phase B/C scope choices explicitly do so.

---

## Data model facts the code relies on

### Already-denormalized fields on `performances` (set by `startSessionForDay()`, `app/app.js:161-251`)

- `exerciseId`, `exerciseName`
- `blockId`, `blockName`, `blockType`, `blockOptional`, `blockRounds`, `blockRestBetweenRoundsSec`
- `prescribedSets`, `prescribedReps`, `prescribedLoad`, `prescribedSideScheme`, `prescribedHoldSec`, `prescribedNotable`
- `prescriptionId` — link back to the source Prescription, **may be `null`** after Phase B (see below)
- `order`, `notes`

These were already present pre-Phase B except `blockRestBetweenRoundsSec`, which was added in commit 1fe2d49.

The Dexie schema (v5, `app/db.js`) **does not declare these denormalized columns as indexes** — they are stored as free-form JSON fields on the Performance object. No schema bump needed; v6 migration described in the original plan turned out to be unnecessary.

### Two invariants that did NOT exist before Phase B

1. **`Performance.prescriptionId` may be `null`** — used when an exercise was added "session only" (no template Prescription written). The session-grouping logic (`sessionGroupedBlocks()`, `app/app.js:283-295`) treats these like any other performance; it groups by `blockId` only.

2. **`Performance.blockId` may be a string** of the form `sess-<timestamp>-<rand>` — used when a session-only block was created. No `Block` row exists for these ids. `sessionGroupedBlocks()` groups by equality, so strings work fine; but any code path doing `await alfdb.blocks.get(perf.blockId)` will return `undefined` and must fall back to the denormalized `perf.blockName / blockType / blockOptional / blockRounds / blockRestBetweenRoundsSec` fields.

If a future feature wants to filter "is this a real template-backed performance", check `typeof perf.blockId === 'number' && perf.prescriptionId != null`.

---

## Alpine state additions (`app/app.js:37-49`)

```js
// Phase A — Backup / Restore
BACKUP_SCHEMA_VERSION: 5,
BACKUP_STORES: [12 store names in canonical order],
showBackup: false,
importText: '',
importPreview: null,        // { parsed, counts } once stageImport() validates
importError: '',
hasUndo: !!localStorage.getItem('alfgym.lastBackup'),

// Phase B — partial sessions
sessionAdd: null,           // { blockId, exerciseQuery, sets, reps, load, sideScheme, holdSec, notable, notes, blockName?, blockType?, blockOptional?, blockRounds?, blockRestBetweenRoundsSec?, lockedScope? }
sessionRemove: null,        // { perfId }
sessionAddBlock: null,      // { name, type, optional, rounds, restBetweenRoundsSec }
```

`localStorage.alfgym.lastBackup` is the one-cycle undo stash for Phase A. `localStorage.alfgym.syntax` is the en/syn toggle.

---

## Phase A — Backup / Restore

### What it does

Menubar `backup` button toggles a panel with:
- **Export**: `download .json` (Blob → `<a download>`) or `copy to clipboard` (JSON string).
- **Restore**: file picker OR paste textarea → `preview` button validates → `replace all` button auto-stashes current state to `localStorage.alfgym.lastBackup` then wipes + bulk-puts every store.
- **Undo last restore**: visible only when `hasUndo` is true; consumes the one-cycle stash.

Schema-version mismatch is **refused** — no cross-version migration. Replace-all is the only mode; merge is deferred to Supabase.

### Methods (`app/app.js:1050-1180`)

| Method | Purpose | Side effects |
|---|---|---|
| `buildBackup()` | Builds the export JSON object from all 12 stores + `alfgym.syntax`. | Read-only. |
| `downloadBackup()` | Triggers a file download named `alfgym-backup-<iso>.json`. | DOM blob URL revoked after click. |
| `copyBackup()` | Writes the JSON string to clipboard. | Clipboard write. |
| `stageImport()` | Parses `this.importText`, validates `app: 'alf-gym'` and `schemaVersion === BACKUP_SCHEMA_VERSION`, sets `importPreview` or `importError`. | Mutates `importPreview` / `importError` only. |
| `stageImportFromFile(ev)` | Reads the picked file into `importText`, calls `stageImport()`. | — |
| `confirmImport()` | Stashes current state to `localStorage.alfgym.lastBackup`, calls `applyBackupReplace`, resets staging. | Destructive: wipes IDB. |
| `applyBackupReplace(parsed)` | Single `db.transaction('rw', allTables, …)` that clears every store then `bulkPut`s the import rows. Restores `alfgym.syntax`. | Destructive. |
| `undoLastRestore()` | Reads `alfgym.lastBackup`, calls `applyBackupReplace`, removes the stash. | Destructive. |

### UI (`app/index.html` Backup panel)

- Menubar button: `backup` toggles `showBackup`.
- Panel: file input → `stageImportFromFile`; textarea → `importText`; buttons → `stageImport`, `confirmImport`, `undoLastRestore`, `downloadBackup`, `copyBackup`.

### Edge cases handled

- localStorage full during pre-restore stash → second `confirm()` to proceed without undo.
- `bulkPut` preserves the original `++id` values so foreign-key references survive round-trip.
- `meta` table uses `&key` primary key; `bulkPut` works because Dexie reads the schema for store-level conventions.

### Manual snapshot (DevTools fallback)

Documented in `app/README.md` "Backup & restore → Manual snapshot via DevTools". Useful when the app UI is broken — produces the same JSON shape, compatible with the in-app Restore flow.

---

## Phase B — Partial sessions

### Three-way scope contract

Every Phase B operation takes a `scope` argument: `'session' | 'template' | 'fork'`.

| Scope | Performance row | Prescription row | Block row | Workout |
|---|---|---|---|---|
| `session` | created/deleted/edited | **untouched** | **untouched** | untouched |
| `template` | created/deleted/edited | created/deleted/edited on the current workout's relevant Block | untouched (for add/remove exercise); created/edited (for add/edit block) | untouched |
| `fork` | created/deleted/edited (after re-pointing to fork) | created/deleted/edited on the **forked** workout's Block | untouched in original; created/edited in fork | forked via `forkSessionWorkout()` |

### `forkSessionWorkout()` helper (`app/app.js:393-455`)

Deep-copies the workout backing the active session and re-points the session to the fork. Returns:

```js
{
  newWorkoutId: number,
  blockIdMap: { [oldBlockId]: newBlockId },
  prescriptionIdMap: { [oldPrescriptionId]: newPrescriptionId },
  dayIdMap: { [oldDayId]: newDayId }
}
```

Critically: **mutates `this.activeSessionPerformances` in place** to swap each performance's `blockId` and `prescriptionId` to the fork's equivalents, and updates `session.workoutId` + `session.dayId` in the DB and in memory. The original workout is set to `isCurrent: 0`.

Naming uses `suggestForkName()` (`app/app.js:621-626`) — bumps the version suffix (e.g. `Workout 9.2 → Workout 9.3`).

### Operations

#### 1. Add exercise inside an existing block

**State**: `sessionAdd = { blockId, exerciseQuery, sets, reps, load, sideScheme, holdSec, notable, notes }`.

**Methods** (`app/app.js`):
- `openSessionAdd(blockId)` — populates a fresh draft.
- `cancelSessionAdd()`
- `commitSessionAdd(scope)`:
  1. Resolve exercise by name via `resolveExerciseByName()` (creates a library entry if absent).
  2. If `scope === 'fork'`, call `forkSessionWorkout()` and remap `targetBlockId` via the returned `blockIdMap`.
  3. If block id is a string sentinel (only possible via `commitSessionAddBlock`'s session-only path), use `draft.blockName / blockType / …` as the block snapshot; otherwise read the Block row.
  4. If `scope === 'template' | 'fork'`, write a new `Prescription` row.
  5. Always write a `Performance` row with denormalized block/prescription fields, plus empty `Set` rows.
  6. Splice the new performance into `activeSessionPerformances` after the last performance in its block.

**UI**: `+ exercise` button at the bottom of each block group + inline form. When `sessionAdd.lockedScope == null`, all three scope buttons render; otherwise the single locked button.

#### 2. Remove exercise from session

**State**: `sessionRemove = { perfId }`.

**Methods**:
- `openSessionRemove(perf)`
- `cancelSessionRemove()`
- `commitSessionRemove(scope)`:
  1. If `scope === 'fork'`, fork first.
  2. Transaction: delete the performance's Sets, then the Performance row. If `scope !== 'session'` and `perf.prescriptionId` is non-null, delete the Prescription too.

**UI**: `×` button (red) on every exercise card title row + a global scope-picker card under all block groups when `sessionRemove` is set.

#### 3. Add a new block mid-session

**State**: `sessionAddBlock = { name, type, optional, rounds, restBetweenRoundsSec }`.

**Methods**:
- `openSessionAddBlock()`
- `cancelSessionAddBlock()`
- `commitSessionAddBlock(scope)`:
  1. If `scope === 'fork'`, fork first.
  2. If `scope === 'template' | 'fork'`, write a real Block row on `activeSession.dayId` (which after a fork is the fork's day). Numeric blockId.
  3. If `scope === 'session'`, generate a sentinel `'sess-<timestamp>-<rand>'` blockId. **No Block row is written.**
  4. Open `sessionAdd` with `blockId` set + block fields stashed in the draft + `lockedScope` set so the first exercise inherits the block's scope. `lockedScope` is `'session'` for session blocks and `'template'` for both template and fork blocks (the fork already happened).

**UI**: `+ block` button below all block groups + form with type/optional/rounds/rest inputs + three scope buttons. After commit, the form is dismissed and a separate add-exercise card appears at the bottom (rendered by `<template x-if="sessionAdd && sessionAdd.lockedScope">`), with a single "add" button instead of three scope buttons.

The form only shows when `sessionAddBlock` is set; the bottom add-exercise card only shows when `sessionAdd.lockedScope` is set. The in-block-group add form (for existing blocks) only fires when `sessionAdd.lockedScope == null`.

### Why `lockedScope`

When the user creates a session-only block (string sentinel), there's no Block row, so a follow-up exercise add to that block cannot be `template` or `fork`. When they create a template block, the block already exists in the template, so the exercise add naturally goes `template` (writing both the Prescription and Performance). For fork: by the time we get to the exercise add, the fork has already happened, so the exercise add behaves as `template` (writing into the fork). `lockedScope` enforces this without giving the user a confusing choice.

---

## Test coverage

All tests are Playwright e2e tests in `tests/e2e/`. Each test resets the DB in `beforeEach`.

### `backup.spec.js` (6 tests, Phase A)

| Test | Asserts |
|---|---|
| `buildBackup returns all stores with seed data` | Shape: `app`, `schemaVersion: 5`, `exportedAt`, all 12 stores as arrays. |
| `round-trip: export, wipe, restore — all stores match` | Deep-equal compare after `clear() → applyBackupReplace()`. Sort by id/key to ignore order. |
| `stageImport rejects non-alfgym JSON` | `importError` contains "Not an alf-gym backup". |
| `stageImport rejects schema-version mismatch` | `importError` contains "Schema mismatch". |
| `stageImport accepts valid backup and produces counts` | `importPreview.counts.workouts > 0`. |
| `undoLastRestore reverts to pre-restore state` | After mutating workout name and applying, undo restores original. |

### `partial-session.spec.js` (10 tests, Phase B)

| Test | Asserts |
|---|---|
| `add exercise — session only` | Prescriptions count unchanged; new Performance has `prescriptionId === null`; 2 sets created. |
| `add exercise — template` | Prescriptions count + 1; new Performance has `prescriptionId === newPrescription.id`. |
| `add exercise — fork` | Workouts count + 1; original workout's prescriptions unchanged; session `workoutId` differs; original `isCurrent === 0`; new workout `parentId === originalId`. |
| `remove exercise — session only` | Prescription kept; Performance gone from `activeSessionPerformances`; 0 sets remain. |
| `remove exercise — template` | Prescription deleted. |
| `remove exercise — fork` | Original prescription kept; session points to fork; original archived. |
| `add exercise inserts at end of its block group` | Splice position is correct. |
| `add block — session only` | Blocks table count unchanged; `lockedScope === 'session'`; `typeof blockId === 'string'`; group appears in `sessionGroupedBlocks()`. |
| `add block — template` | Blocks-in-day count + 1; new block has correct `type/rounds/restBetweenRoundsSec`; `sessionAdd.blockId === newBlock.id`; `lockedScope === 'template'`. |
| `add block — fork` | Workouts + 1; session re-pointed; new block's day belongs to new workout; original archived; `lockedScope === 'template'`. |

### `session.spec.js` (4 tests, pre-existing, still pass)

Smoke tests for session start, capture view, set-row render, and no-JS-errors-on-load.

Run all: `npx playwright test`. Webserver auto-starts (`python3 -m http.server 8000` from `app/`) per `playwright.config.js`.

---

## File map (where to look during debugging)

| File | What it holds |
|---|---|
| `app/app.js:8-973+` | `alfApp()` Alpine factory. State + methods. Phase A backup methods near the bottom; Phase B methods inserted between `updatePerformanceNotes` and `sessionElapsed`. |
| `app/app.js:393-455` | `forkSessionWorkout()` — the linchpin of Phase B fork scope. |
| `app/app.js:161-251` | `startSessionForDay()` — the original snapshot writer. **Sets the denormalized fields on Performance.** |
| `app/db.js` | Dexie schema (v5). 12 stores. Seed in `seedIfEmpty()`. |
| `app/index.html:58-100` | Menubar + Backup panel. |
| `app/index.html:307+` | Session view: block groups loop, exercise cards, add-exercise inline form, add-block form, sessionRemove scope picker, sessionAdd locked-scope form. |
| `tests/e2e/backup.spec.js` | Phase A coverage. |
| `tests/e2e/partial-session.spec.js` | Phase B coverage. |
| `tests/e2e/session.spec.js` | Pre-existing session smoke tests. |
| `app/README.md` | User-facing instructions for Backup & restore + manual DevTools snapshot. |

---

## Likely failure modes — quick triage checklist

### "My imported backup did nothing"

- Check the schema version: `stageImport()` refuses any file whose `schemaVersion` differs from `BACKUP_SCHEMA_VERSION` (currently 5).
- Check the `app` field — must equal `'alf-gym'`.
- Check `importError` in DevTools: `document.querySelector('[x-data]')._x_dataStack[0].importError`.

### "Session-only exercise disappeared after restore"

- It shouldn't. Performances are in the backup. If it's missing, dump `performances` from both the export and the post-restore IDB and compare. The `prescriptionId === null` value must survive (bulkPut preserves nulls).

### "Forking from a session created weird state"

- `forkSessionWorkout()` mutates `this.activeSessionPerformances` in place. If the calling code captured `perf` references before the call, those references are still valid (same objects) but now have new `blockId / prescriptionId` values.
- `session.workoutId` and `session.dayId` are updated in the DB and on `this.activeSession`. If something else reads `activeSession.workoutId` and caches it, that cache is now stale.
- The original workout's `isCurrent` is set to 0 — not deleted. If "current workout" UX relies only on `isCurrent`, it'll reflect the fork.

### "Add-block session-only created a Block row anyway"

- Should not. `commitSessionAddBlock('session')` generates a string sentinel id and skips `alfdb.blocks.add()`. Check the value of `app.sessionAdd.blockId` after — should start with `sess-`.

### "Add-block fork wrote into the original workout"

- `commitSessionAddBlock('fork')` calls `forkSessionWorkout()` first, which updates `this.activeSession.dayId` to the fork's day. The subsequent `alfdb.blocks.add({ dayId: this.activeSession.dayId, … })` should now point at the fork. If this is broken, check that `forkSessionWorkout()` ran the in-memory `this.activeSession.dayId = dayIdMap[…]` line.

### "Backup file is huge / localStorage full during restore"

- The undo stash is a full JSON serialization of the current IDB. If sessions/sets are heavy, this can exceed ~5 MB and `localStorage.setItem` will throw. `confirmImport()` catches this and asks the user whether to proceed without undo.

### "sessionGroupedBlocks shows the wrong order"

- It preserves the order of `activeSessionPerformances`. When adding a performance, `commitSessionAdd()` splices it after the last performance in the same block — this is the only ordering logic. If groups appear shuffled, check that performance `.order` values are monotonic.

---

## Open / not yet shipped

### Phase C — In-place edit of prescriptions and blocks during a session

Not started in code. Would need:

- `sessionEditPerf` + `sessionEditBlock` Alpine state.
- `openEditPerf(perf) / commitEditPerf(scope) / cancelEditPerf()` updating `Performance` (always), `Prescription` (template/fork), with `forkSessionWorkout()` called for fork.
- Same trio for blocks: `openEditBlock(group) / commitEditBlock(scope) / cancelEditBlock()`. For sentinel-string blockIds, only `session` scope is valid (no Block row exists to edit at template level).
- For session-only edits of a `Performance` with `prescriptionId === null`, only `session` scope is valid.
- UI: an `edit` button on each block group head + each exercise card title row + inline forms with scope pickers.
- No Dexie migration needed — the necessary fields are already denormalized on `performances` (commit 1fe2d49 added the last missing one, `blockRestBetweenRoundsSec`).

### Deferred architectural decision

**Drop numbered-category blocks in favour of tags on exercises?** Flagged in the original plan, not decided. Trade-off: dropping blocks loses `circuit` semantics (rounds + rest); a middle path is to keep blocks but add `Exercise.tags: string[]` for cross-cutting grouping. Worth revisiting once Phase C ships and we know how often users actually edit block structure mid-session.

### Stopgap-only limits to be aware of

- **Cross-device sync.** Manual export → import. No conflict resolution. Real merge is Supabase's job.
- **Per-device user.** No user/profile concept; one user per browser.
- **Schema version bumps.** Currently locked at v5. Any v6 bump must add a clear migration in `app/db.js` AND raise `BACKUP_SCHEMA_VERSION`; old backups will be refused at restore-time. Plan a one-shot upgrade utility before bumping in production data.

---

## Quick reference — key constants

```js
BACKUP_SCHEMA_VERSION = 5
BACKUP_STORES = ['workouts','days','blocks','exercises','prescriptions',
                 'sessions','performances','sets','painMarks','trackers',
                 'wishlist','meta']

localStorage keys:
  alfgym.syntax        — '0' or '1'
  alfgym.lastBackup    — JSON string, one-cycle restore undo

Sentinel patterns:
  blockId: number (real) | 'sess-<timestamp>-<rand>' (session-only)
  prescriptionId: number (real) | null (session-only)
```
