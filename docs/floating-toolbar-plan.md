# Plan F — Floating toolbar (quick-capture)

Status: draft, 2026-05-14. Owner: Alvar. Independent of Plan E. Solves "getting data in" — Plan E solves "getting data out."

## Why this exists

Two captures happen constantly during training and you should never have to navigate to do them:

1. **Wishlist add.** "Saw a guy doing this exercise, want to try it next cycle." Currently requires going to `#/wishlist`. The friction means it doesn't get logged.
2. **Note add.** "Felt sharp pain on rep 7." "Sleep was 5 hours." "Cue from PT: tuck pelvis on the eccentric." Currently no place exists for free-form notes that aren't tied to a specific prescription.

Both are time-sensitive captures where opening the right view kills the urge to capture at all. A floating toolbar — always visible, always one tap away — removes the friction.

## Non-goals

- Replacing the existing wishlist screen. Toolbar is *capture*; the screen remains for review and management.
- Building the "global lines" syntax for notes now. The schema must leave room for it; the parser ships later.
- Reordering / multi-line rich text in notes v1. Plain textarea, datestamped.

## Placement

Bottom-right corner, fixed-position, expands upward on tap. Coexists with the existing global "new session" floating button (which sits bottom-centre, per `SPEC.md`).

```
                                          ┌─────┐
                                          │  +  │  ← floating toolbar trigger
                                          └─────┘
              ┌────────┐
              │   ⏱    │  ← existing new-session button (centre)
              └────────┘
```

Tap the `+` → expands to:

```
                                          ┌─────┐
                                          │  ★  │  ← add to wishlist
                                          ├─────┤
                                          │  ✎  │  ← add note
                                          ├─────┤
                                          │  ×  │  ← collapse
                                          └─────┘
```

Both items open a lightweight modal/sheet, not a full route change — capture should feel inline, not navigational.

## Feature 1 — Wishlist quick-add

**Behaviour.**

1. Tap `★` from the toolbar.
2. Sheet opens with the omnibox (same exercise picker pattern as `app/app.js` already uses for in-session add).
3. Type to search existing exercises, or type a new name to create.
4. Tap Save → row written to existing `wishlist` table (`db.js:32-34`).
5. Sheet dismisses; toast confirms.

**No schema change.** `wishlist` already exists as `{ id, exerciseName, createdAt }`.

**Optional v1.1:** while inside a session, default-prefill a "context" hint in the wishlist row so review later can show "wished for this during Day A on May 13." Schema add: `wishlist.contextSessionId?`. Defer unless useful in practice.

## Feature 2 — Notes

**Schema (new table).**

```js
notes: '++id, date, sessionId, createdAt, updatedAt'
```

Fields:

| Field | Type | Notes |
|---|---|---|
| `id` | autoinc | local PK |
| `body` | string | free text, plain for v1 |
| `date` | `YYYY-MM-DD` | auto-set to today on create; editable |
| `sessionId` | nullable FK | auto-pinned if a session exists on that date and the user opts in |
| `createdAt` | ISO ts | immutable |
| `updatedAt` | ISO ts | bumped on edit |

**Behaviour.**

1. Tap `✎` from the toolbar.
2. Sheet opens with: date picker (default today), large textarea, "pin to today's session" toggle (only enabled if a session row exists for `date`).
3. Save writes a `notes` row.
4. Sheet dismisses; toast confirms.

**Why date-keyed and freestanding.** Notes need to survive rest days. They also need to be easy to attach to a session when one exists. Freestanding-with-auto-date achieves both: every note has a date axis (always queryable that way), and an optional session axis (set when relevant). No need to invent a separate `journal` concept.

**Review surface.** Two affordances, deferred to v1.1 — capture is the priority:

- On a session card: show all notes with `sessionId === session.id` OR `date === session.startedAt.slice(0,10)`.
- On a future calendar / journal view: show notes by `date`.

**Future "global lines" syntax (planning only, do not build yet).**

Idea: lines in `body` prefixed with a sigil get promoted to first-class objects when rendered. E.g.

```
slept poorly, 5h
#cue: drive heels through floor on BSS
#pain: L hip 2/5 during R3 of KB compound
#asym: L slower to stabilise on single-leg balance
```

A future parser would, on read:

- Plain lines render as note body.
- `#cue:` lines could attach the cue to the named exercise (via fuzzy match) and propagate to future displays of that exercise.
- `#pain:` lines could create a `painMarks` row if one doesn't exist.
- `#asym:` / `#skill:` lines feed the trackers table.

Schema implication today: `body` is opaque text. The parser is purely a *read-side* projection — nothing about the storage shape needs to change for this future to remain available.

**Anti-scope for the syntax now.** We do not write the parser, the sigil set, the propagation rules, or the conflict resolution between parsed and explicit rows. Just leave the door open by storing notes as plain text.

## Implementation notes

- New Dexie schema bump: `db.version(6).stores({ notes: '++id, date, sessionId, createdAt, updatedAt' })`. Add to `BACKUP_STORES` so notes ride along in exports.
- Toolbar component lives in `index.html` as a sibling to the existing new-session button. Pure CSS + Alpine state, no new library.
- Sheet for note add: reuse the same modal pattern the backup panel uses (`app/index.html:91-138`) to keep things consistent.
- Toolbar visibility: always visible except inside the live-session capture view (where it would compete with the set-entry affordances). Confirm with use; revisit if it gets in the way.

## Testing

- Playwright: open toolbar, add a wishlist item, assert row in `wishlist`. Add a note with today's date, assert row in `notes`. Edit a note, assert `updatedAt` bumped.
- Manual on phone: thumb-reachability of the bottom-right toolbar; sheet doesn't collide with the on-screen keyboard.
- Backup roundtrip: full export + restore preserves `notes` rows verbatim.

## Sequencing

1. Wishlist quick-add (no schema bump, smallest).
2. Notes table + add sheet (schema v6).
3. Review surfaces on session cards.
4. Optional v1.1: wishlist context hint, calendar/journal view.
5. (Much later) global-lines syntax parser — separate plan when it stops being speculative.

## Interaction with Plan E

The notes table joins the export. Per-session JSON exports (Plan E §1.1) gain a `notes` field in the `context` block, populated with any notes where `sessionId === thisSession` OR `date === thisSession.startedAt.slice(0,10)`. Markdown export prints them under a `## Notes` heading at the bottom. CSV export adds a `notes.csv` mode in the same panel.

PocketBase migration (Plan E §2) mirrors `notes` as a 13th collection. No special handling.
