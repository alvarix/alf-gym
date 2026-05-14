# alf-gym Handoff

A snapshot for the next model picking up this project. Covers state, decisions, and what's next.

## TL;DR

A mobile-first PWA for tracking gym workouts. Local-first (IndexedDB), structured data, two display modes (en / syn). One project owner. Currently a wired Alpine prototype at `app/`. Target stack: SvelteKit + Vercel + Supabase + Dexie. Migration plan in `docs/migration-sveltekit.md`.

Phase: **r4.0 complete** — sessions capture flow lands. Next: r4.1 capture polish (prefill last cycle, chevron increments).

## Where things live

```
~/Sites/apps/alf-gym/
├ SPEC.md                      living planning doc, source of truth
├ CHANGELOG.md                 dated entries per round
├ README.md                    project intro + decisions locked
├ docs/
│  ├ architecture.md           tech choices and tradeoffs
│  ├ decisions.md              ADR-lite log (ordered newest first)
│  ├ notation.md               canonical syntax reference
│  ├ migration-sveltekit.md    target stack and 13-step migration
│  ├ user-stories.md           builder + sessions + history stories
│  ├ review-r3.2.md            design+use process findings
│  └ handoff.md                this file
├ tests/README.md              planned test approach
├ app/                         wired Alpine prototype
│  ├ index.html
│  ├ app.js
│  ├ db.js
│  ├ assets/styles.css
│  └ README.md
└ vercel.json                  Vercel deploy config (outputDirectory: app)
```

Mockup folders (`mockup/`, `mockup-v1/`, `mockup-v2/`) are git-ignored. They were stepping stones; the wired `app/` is canonical now.

## Stack

- **Now:** Alpine.js (CDN) + Dexie (CDN) + IndexedDB. No build step. Static. Open `app/index.html` directly or `python3 -m http.server` from inside `app/`.
- **Target:** SvelteKit + Tailwind + Dexie + Supabase + Vercel. Hand-rolled sync (LWW + outbox + `updatedAt`/`syncRev`) for single-user. Plan in `docs/migration-sveltekit.md`.

## Domain model (canonical)

```
Workout         { id, name, parentId, status, isCurrent, createdAt }
  parentId for lineage; null = root. Forking copies content.

Day             { id, workoutId, groupKey, name, isAlt, order }
  groupKey groups Day A and Day A alt under one section in the picker.

Block           { id, dayId, name, type: 'linear'|'circuit', optional, rounds?, restBetweenRoundsSec?, order }

Exercise        { id, name, parentId (variation lineage), category, equipment }
  e.g. parent BSS -> Smith machine BSS, Tempo BSS with DBs (variations)

Prescription    { id, blockId, exerciseId, sets, reps, load, sideScheme, holdSec, notable, notes, order }
  load is a string: '50', '50,55,60', '^15', '(35)', 'band', '0' (bw)

Wishlist        { id, exerciseName, notes, createdAt }
  global queue of exercises to incorporate into future blocks

Session         { id, dayId, workoutId, startedAt, endedAt, status: 'in_progress'|'completed', mood, env }
Performance     { id, sessionId, prescriptionId, exerciseId, blockId, order, notes,
                  exerciseName, blockName, blockType, blockOptional, blockRounds,
                  prescribedSets, prescribedReps, prescribedLoad, prescribedSideScheme,
                  prescribedHoldSec, prescribedNotable }
                  (denorm + snapshot of prescription at session start)
Set             { id, performanceId, setIndex, reps, load, side, holdSec, notable, done, notes }
PainMark        { id, sessionId, performanceId?, severity, side, region, ts }

Tracker         { id, name, kind: 'injury'|'asymmetry'|'skill', status, severity, side, notes }
                  data layer present, UI deferred to P2 mockup

meta            single-key store; { key: 'seeded', value: ts } guards seed
```

Dexie schema currently at **v5**. Resetting (JSON panel → reset DB) re-seeds Workout 9 (archived) + Workout 9.2 (current) with Day A populated and Day A alt empty.

## Notation v3.1

- Weight: `115` (total bar), `(35)` plate per side, `^15` cable level, `!` suffix = notable (first time at this load).
- Reps: `8` bilateral, `;8` per side. (`:8` accepted as legacy and normalized to `;8` on import.)
- Time hold: `30s`. With per-side: `30s;`.
- Sets: `-3` or `-III`.
- Pain: `$3 L hip` = severity 3 (0-10), left, hip.
- Mood: `8:)` numeric.

Examples: `95!;8-3` = 95 lb notable, 8 reps per side, 3 sets. `^15;10-2` = cable 15, 10 per side, 2 sets.

Two display modes (app-wide menubar toggle):
- **en**: discrete fields, no syntax tokens visible. Load split into `kind` (lb / plate / cable / band / bodyweight) + `value`.
- **syn**: a single mono token field per prescription.

## Routes

```
#/                                 workouts list
#/wizard                           new workout wizard
#/wishlist                         wishlist view
#/sessions                         sessions list
#/s/{sessionId}                    session capture / read-only
#/w/{workoutId}                    workout (days list)
#/w/{workoutId}/d/{dayId}          day (blocks list)
#/w/{workoutId}/d/{dayId}/b/{id}   block (exercises list)
```

Hash router lives in `app/app.js#routeFromHash`. Each view sets `view` to one of: `workouts | wizard | wishlist | sessions | session | workout | day | block`.

## What's working

- Workouts CRUD with archive + lineage display + fork action
- New-workout wizard (name, parent, days, skeleton)
- Day skeletons (A: Warmup/Squat/Push/Anti-Rotation/Plyo. B: Warmup/Hinge/Lunge/Pull/Hips/Rotation. C: Warmup/Skill/Diagnostic ISO)
- Days CRUD with alt grouping
- Blocks CRUD with linear/circuit toggle + optional flag
- Exercises CRUD with inline edit (click row title to toggle), omnibox with autocomplete + new-exercise creation, save-and-add-another, duplicate row
- En vs syn forms (different field shapes)
- Wishlist (★ in menubar, dedicated view, "from wishlist" panel in block view)
- Sessions: start from any day (▶ button), live capture with set rows (reps/load/side/done), `+ set`, `repeat last`, `$ pain`, per-perf notes, end with mood + env, status flips to read-only
- Sessions list with status pills and delete
- Hash-routed URLs (back/forward, bookmarkable)
- Idempotent seed (no duplicates on reload)

## What's NOT working / NOT built

- **Prefill last cycle's actuals** in new sessions (rows start empty; `repeat last` is the workaround). Highest-value next slice.
- **Chevron increments** (1/5/10 ± buttons) for set entry. Currently raw inputs.
- **Per-exercise history view** (chart + variations toggle + timeline). The mockup-v2 views were good; data is there to power them.
- **Drop-in blocks** (PT routines pulled mid-session)
- **Pain log alongside last week's records** in capture
- **Supersets** (paired exercises within a linear block)
- **Trackers UI** (data shape exists, no view)
- **Importer** (4-step flow, deferred to P3)
- **Cloud sync, auth, install prompt, service worker** — all post-SvelteKit
- **Tests** — `tests/README.md` describes intent; no actual tests written

## Decisions locked (don't relitigate without cause)

See `docs/decisions.md` for the full ADR log. Highlights:

- Single `Workout` entity at the top. No Program/Variant. Lineage via `parentId`.
- Storage is structured (IndexedDB / Postgres). Markdown is import/export only.
- Hierarchical numbering everywhere: `2.1`, `2.2`.
- En mode discrete, syn mode token-only. Storage identical.
- Notable (`!`) stays as user input; rendered as pill in en, `!` suffix in syn.
- Click row title toggles inline edit.
- Sessions snapshot prescriptions onto Performances at start (history doesn't shift when templates change).
- Capture autosaves on input `change`.
- Speech-to-text deferred to P4. Quick-edit-by-prompt deferred to P3.

## Bug / friction list (for the next model)

1. The bash sandbox can't remove `.git/index.lock` and `.git/tlAjmRQ` on the iCloud-mounted folder. User cleans those manually.
2. Schema bumps (v2→v3, v3→v4, v4→v5) wipe data on first load. We rely on the user resetting + reseeding.
3. `prompt()` is still used for: fork name, pain mark fields. Should be inline forms eventually.
4. Drag-to-reorder is not wired anywhere; arrow buttons (`↑ ↓`) substitute.
5. moveDay scopes within `groupKey` (correct since r3.3); moveBlock and moveExercise scope across the full list (likely correct).
6. The session view's "elapsed" doesn't auto-tick (only updates on render). Set up an interval if needed.
7. No empty-state for the sessions list points back to a Day; the user must navigate to Workouts → a Day → ▶.
8. No undo for delete actions (sessions, days, blocks, exercises). Confirm dialog is the only safety.

## Conventions

User preferences (carry over):
- No em dashes — use a regular hyphen or colon.
- Bold inline only; proper markdown hierarchy (don't bold headers).
- Don't commit or push without approval. Show commit drafts.
- Don't write code to files without explicit request. `~/Sites/apps/` is the looser zone — but ask if in doubt.
- Colon-prefixed sentence at start of message = title for that conversation.
- When a milestone is reached, suggest summarizing for documentation.

Commit message format: `area: short description`. Areas: `spec`, `app`, `web`, `infra`, `docs`, `tests`.

## Recommended next steps (priority order)

### r4.1 — Capture polish (highest value)
- **Prefill last cycle's actuals** into new set rows. Look up the previous Session for the same Day (or ascendant Workout's same exerciseId), copy values into reps/load/side. Show as ghost values until user confirms.
- **Chevron increments**: `−` `+` buttons next to weight and reps cells, with a 1 / 5 / 10 switcher. Reduces typing during a workout.
- **Repeat-last-set** smarter: if previous-set values match prescribed exactly, mark notable false; if they exceed prior max, prompt for notable.

### r4.2 — Per-exercise history view
- New route `#/exercise/{id}` — chart of working-set load over time (Chart.js or sparkline), variations toggle, timeline list.
- Tap an exercise name anywhere in the app to navigate there.
- Reference the mockup design in commits — it's solid; data is now real.

### r4.3 — Drop-in blocks + pain log alongside
- New entity `templateBlocks` (or `dropInBlocks`): a Block-shaped record not tied to any Day. Seeded with a "Shoulder PT" example.
- During an in-progress session, `+ drop-in` button opens a picker. Selecting one materializes its prescriptions + sets into new Performances on the active session.
- In the per-exercise history (or capture row), surface last week's pain marks for the same exercise.

### r4.4 — Supersets (focused round)
- Add `Prescription.groupKey` (string, optional). Adjacent rows in a linear block sharing a groupKey form a superset.
- UI: render same-groupKey rows joined visually. In capture, alternate set-by-set across the group.
- Migration: existing prescriptions get `groupKey: null`, behavior unchanged.

### r4.5 — SvelteKit migration
- Start fresh in `web/` per `docs/migration-sveltekit.md`.
- Port domain types to TypeScript first, then routes one at a time.
- Sessions in SvelteKit benefits most from real reactivity and forms.

### Later
- Trackers UI (P2 mockup design as reference).
- Importer (P3, stepped 4-screen flow).
- Cloud sync (Supabase).
- PWA install + offline + service worker.
- Speech (re-evaluate based on iOS standalone mode reality).

## Quick onboarding for the next model

1. Read `SPEC.md` end to end (it's ~250 lines).
2. Skim `docs/decisions.md` (ADRs ordered newest first; the most recent ones bind).
3. Glance `CHANGELOG.md` (round-by-round narrative).
4. Open `app/index.html` in a browser. Click around. Reset DB once. Start a session.
5. Read `app/app.js` end to end (one file, ~880 lines, all interactions live there).
6. Look at `docs/migration-sveltekit.md` to see where this is heading.

The mental model worth holding:
- **Templates** (Workouts → Days → Blocks → Prescriptions) are the design surface.
- **Sessions** (Sessions → Performances → Sets) are the capture surface.
- A Performance is a snapshot of a Prescription at session start. The two layers don't entangle.
- En and syn are two views of the same data; never compromise storage to fit one mode.
