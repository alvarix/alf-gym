# Handoff: Builder/Session unification — Phase C resumption

A session-handoff for the next thread picking up the builder/session unification work. **Read `docs/builder-session-export.md` first** — it is the complete implementation reference for what already shipped. This file is the pointer + next-action briefing.

---

## TL;DR

A three-phase plan was scoped to make every prescribed value editable in-place during a live session with a *session / template / fork* scope picker, plus a stopgap full-IDB backup/restore.

- **Phase A** (backup/restore) — shipped, commit `8e8a3e2`.
- **Phase B.1** (add/remove exercise mid-session) — shipped, commit `1fe2d49`.
- **Phase B.2** (add new block mid-session) — shipped, commit `231c2ed`.
- **Phase C** (in-place edit of prescriptions and blocks) — **not started**. State stubs were created and then reverted; the codebase reflects only Phase A and B.

20 Playwright tests pass. Three commits on `master`, **not pushed** to `origin/master`.

---

## Repo state at handoff

```
Branch:    master
Status:    3 commits ahead of origin/master, not pushed
Working:   clean (untracked: docs/db-spec.md, docs/builder-session-export.md, docs/handoff-phase-c.md)

Last 3 commits:
  231c2ed feat(session): add new block mid-session with template/fork/session scope
  1fe2d49 feat(session): add and remove exercises mid-session with template/fork/session scope
  8e8a3e2 feat(io): full IDB backup and restore with one-cycle undo
```

The originating multi-phase plan is at `/Users/alvarsirlin/.claude/plans/opus-builder-session-export-magical-snail.md`.

---

## Read these before doing anything

1. **`docs/builder-session-export.md`** — exhaustive reference for Phase A/B. Glossary, three-way scope contract, state invariants (nullable `prescriptionId`, string-sentinel `blockId`), method index, test coverage map, triage checklists.
2. **`app/app.js:161-251`** — `startSessionForDay()`. The snapshot writer that denormalises Prescription + Block fields onto `Performance`. Phase C edits mutate the same denormalised fields.
3. **`app/app.js:393-455`** — `forkSessionWorkout()`. The shared helper for fork-scope operations. Phase C edits will call it the same way Phase B does.
4. **`docs/builder-session-export.md` § "Open / not yet shipped"** — the Phase C plan in detail.
5. **Originating plan file** (above) — for the full design history and architectural decisions made.

---

## Decisions already locked in (do not re-litigate)

- **Phasing.** Three independent commits, in order: A → B.1 → B.2 → C. Atomic commits per phase, no bundling.
- **Q2 — edit granularity.** Block-level edits ARE in scope for Phase C (name, type, rounds, optional, restBetweenRoundsSec).
- **Q3 — block categories.** No formal `category` field. Numbered-category blocks stay as plain `Block.name` text. Library picker (if/when built) does name search only.
- **Q4 — import strategy.** Replace-all + one-cycle undo. Merge is deferred to Supabase.
- **No Dexie v6 migration needed.** The denormalised fields on `performances` (`blockName/Type/Optional/Rounds/RestBetweenRoundsSec`, `exerciseName`, `prescribed*`) already exist — they were always written by `startSessionForDay()` but undeclared in the schema. Phase B added the last one (`blockRestBetweenRoundsSec`). Dexie stores arbitrary JSON on rows; no schema bump.
- **Deferred architectural question:** "drop numbered-category blocks for tags on exercises?" — Flagged in the plan, not decided. Revisit after Phase C ships.

---

## Phase C — what to build

### Scope

Pencil-style `edit` affordance on every:
1. **Block group header** in the session view (`sessionGroupedBlocks()` output).
2. **Exercise card title row** (every `Performance`).

Tapping opens an inline form with all editable fields. Save offers a three-way scope picker matching Phase B's pattern.

### State to add to `alfApp()` (`app/app.js:8-49`)

```js
sessionEditPerf: null,  // { perfId, fields: { exerciseQuery, sets, reps, load, sideScheme, holdSec, notable, notes } }
sessionEditBlock: null, // { blockId, fields: { name, type, optional, rounds, restBetweenRoundsSec } }
```

### Methods to add

Insert in the same Phase B region of `app/app.js` (after `commitSessionRemove`, before `sessionElapsed`):

```js
openEditPerf(perf)         // populate sessionEditPerf draft from perf
cancelEditPerf()
commitEditPerf(scope)      // 'session' | 'template' | 'fork'

openEditBlock(group)       // populate sessionEditBlock draft from group's denormalised fields
cancelEditBlock()
commitEditBlock(scope)
```

### `commitEditPerf(scope)` contract

1. Resolve exercise via `resolveExerciseByName()` if `exerciseQuery` changed.
2. If `scope === 'fork'`, call `forkSessionWorkout()` first. The targeted `perf` will be mutated in place to point at the fork's ids.
3. Compose `perfPatch` with new `exerciseId`, `exerciseName`, `prescribedSets`, `prescribedReps`, `prescribedLoad`, `prescribedSideScheme`, `prescribedHoldSec`, `prescribedNotable`, `notes`.
4. If `scope !== 'session'` **and** `perf.prescriptionId != null`, also update the `Prescription` row.
5. Apply `perfPatch` to the `Performance` row and to the in-memory `perf` object.
6. Decide policy on Set-row count changes when `sets` increases or decreases:
   - **Recommended for v1:** leave Set rows untouched. The prescribed count changes, but the user adds/removes actual sets via the existing `+ set` / `×` affordances.
   - Document this in the commit message.

### `commitEditBlock(scope)` contract

1. **Sentinel guard:** if `typeof draft.blockId === 'string'` and `scope !== 'session'`, refuse (alert: "session-only blocks have no template row").
2. If `scope === 'fork'`, fork; remap `blockId` via `r.blockIdMap[draft.blockId]`.
3. If `scope !== 'session'`, update the `Block` row: `name`, `type`, `optional`, `rounds`, `restBetweenRoundsSec`. When `type` changes:
   - `linear → circuit`: write `rounds` + `restBetweenRoundsSec`.
   - `circuit → linear`: write `rounds: null`, `restBetweenRoundsSec: null`.
4. Always update every `Performance` row in the session whose `blockId === blockId` (after any fork remap) with the new denormalised `blockName/Type/Optional/Rounds/RestBetweenRoundsSec`. Apply the same patch to the in-memory perfs.

### UI to add

In `app/index.html`, inside the session view:

- **Edit button on each block group header.** Adjacent to the existing block-name/type/optional pills. Sets `sessionEditBlock` when clicked.
- **Edit button on each exercise card title row.** Next to the existing `×` remove button. Sets `sessionEditPerf` when clicked.
- **Inline form for `sessionEditBlock`** — render below the group header, before its exercise cards. Fields: name, type, optional, rounds (circuit only), rest (circuit only). Scope picker: three buttons, but when `typeof sessionEditBlock.blockId === 'string'` render only the `session` button.
- **Inline form for `sessionEditPerf`** — render in place of (or below) the exercise card. Fields: exercise (omnibox with `<datalist id="alfgym-ex-options">`), sets, reps, load, side, hold, notable, notes. Scope picker: three buttons, but when the target `perf.prescriptionId == null` render only the `session` button.

Follow the Phase B form styling exactly (`background: var(--surface-2)`, `class="ix-card"`, scope buttons in a `row tight` with `gap: 6px`, the `fork` button in `color: var(--danger)`).

### Test plan — write in `tests/e2e/edit-in-session.spec.js`

Mirror the structure of `partial-session.spec.js`. Suggested matrix:

- `edit prescription — session only`: Performance updated, Prescription row untouched.
- `edit prescription — template`: Prescription updated; Performance updated.
- `edit prescription — fork`: New workout; original Prescription untouched; session re-pointed; Prescription edited in fork.
- `edit prescription — exercise swap`: Performance.exerciseName and .exerciseId both update; if a new library entry was created, `exercises` table grew by 1.
- `edit block — session only`: Block row untouched; all matching Performance rows updated.
- `edit block — template`: Block row updated; all matching Performance rows updated.
- `edit block — fork`: New workout; original Block untouched; session re-pointed; Block edited in fork; Performance rows updated.
- `edit block — sentinel session-only block`: only `session` scope works; template/fork attempts refused.
- `edit prescription — session-only perf (prescriptionId === null)`: only `session` scope works.
- `edit block — type change linear → circuit`: rounds + restBetweenRoundsSec written.

Run: `npx playwright test`. All existing 20 tests must continue to pass.

### Commit message

```
feat(session): edit prescriptions and blocks mid-session with template/fork/session scope

Pencil affordance on every block header and exercise card opens an inline
form. Save offers the same three-way scope picker as Phase B: session-only
(updates the Performance snapshot only), template (also updates the
Prescription/Block row), or fork (deep-copies the workout, re-points the
session, then edits in the fork). Block-level fields covered: name, type,
rounds, optional, restBetweenRoundsSec. Set-row counts are not adjusted
when prescribedSets changes; the user manages actuals via existing
+ set / × set affordances. Edits to session-only blocks (string-sentinel
blockId) or session-only performances (null prescriptionId) are locked to
session scope. N new Playwright tests cover the matrix.
```

---

## Validation steps before declaring Phase C done

1. `npx playwright test` — all tests green (20 prior + new Phase C tests).
2. Start the dev server (`python3 -m http.server 8000` from `app/`) and open the app in the browser. Smoke the UI manually:
   - Start a session for Day A.
   - Edit an exercise's prescribed sets → "session only" → reload session → value persists; navigate to the builder → original prescription unchanged.
   - Edit again → "to template" → builder reflects change.
   - Edit again → "fork" → see new workout in the workouts list; session now points there.
   - Edit a block header's `type` from linear to circuit → confirm rounds field appears in subsequent edits.
3. Run a full backup → wipe IDB → restore → confirm edited values survived.

---

## Validation steps before declaring the whole project done

The originating plan's verification section in `docs/builder-session-export.md` (Test coverage table) plus:

- End-to-end smoke: backup → edits + adds across all scopes → backup again → wipe → restore → all changes survive.
- Run `npx playwright test` cleanly.
- Push to `origin/master` only after user explicitly says push (this user does not auto-push).

---

## Open items / nice-to-haves (do not block Phase C)

- **Markdown importer** — separate spec in `docs/importer.md`, P3.
- **Trackers UI** — data layer present, P2.
- **Drop blocks for tags** — see Phase C plan § "Open architectural question". Revisit later.
- **Supabase sync** — replaces all of this stopgap eventually. Schema decisions live in `docs/db-spec.md`.

---

## Style and convention reminders

From the user's global `CLAUDE.md`:

- Never commit unless explicitly instructed.
- Conventional commits, brief, no emojis, no attribution.
- Suggest tests, README, CHANGELOG updates when appropriate.
- Atomic commits per phase.
- Never run destructive git operations without permission.
- Suggest a database backup before any destructive action (use the new in-app `backup` button — that's exactly what Phase A is for).
- Address the user as "Alvar". The user is on macOS, zsh, working at `~/Sites/apps/alf-gym/`.
