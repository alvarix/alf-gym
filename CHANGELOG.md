# Changelog

All notable changes to alf-gym are recorded here. Newest entries on top.

## 2026-05-17 r4.10

### Added
- **Session progress bar**: under the header, a thin filled bar plus `done/total sets · pct%` meta. Reads from the live `_sets` array via `sessionProgress()` so it ticks as boxes are checked.
- **Email session summary**: `email` button on completed sessions opens a `mailto:` with the human-readable summary in the body, subject `alf-gym <date> — <workout> / <day>`. Zero infra — works with whatever mail client the device has.
- **Mid-session "add exercise to new block" now lets you change scope**: previously the exercise scope was locked to the block's scope (single `add` button). When the block exists in the workout (template-scope), all three buttons show. For session-only blocks, scope stays forced to session (the block doesn't exist in the workout, so template/fork can't host it).

### Changed
- **Mobile menubar**: title row gets full width, action buttons wrap with proper gaps and taller (32px) touch targets.

### Fixed
- Removed 8 stale diagnostic `console.log` calls in `openSession`, `startSessionForDay`, and `confirmImport` (postmortem follow-up from r4.7).
- Two pre-existing Playwright tests broken by the r4.5 date picker step: helper `startSessionFromFirstDay()` now opens the picker and commits with default-now.

## 2026-05-15 r4.9

### Fixed
- **Session timer now live-updates**: elapsed time was stuck at 0 because `sessionElapsed` called `new Date()` once on render with no mechanism to re-render. Added a reactive `now` property ticked every 30s via `setInterval`; `sessionElapsed` reads `this.now` so Alpine re-renders the display automatically.

### Changed
- **FAB visible only during active session**: floating toolbar now shows only when `status === 'in_progress'`, not on all non-session views.
- **Wishlist sheet backdrop**: semi-transparent overlay added behind the wishlist quick-add sheet; tapping it closes the sheet.

## 2026-05-15 r4.8 (session capture UI overhaul)

### Added
- **Exercise cues field**: editable textarea in the block exercise editor (persisted on the `exercises` record). Shown in session capture as a collapsible drawer (`cues ▸`) per exercise — keeps the card compact for long cue text.
- **Day name on sessions**: both the session list (`Workout 9.2 · Day A - Front`) and the session header now show the day variation name. New sessions store `dayName` on the record; old sessions look it up from the days table on load.
- **Edit mode for completed sessions**: each exercise card on a finished session shows an `edit` button. Tapping it unlocks the set value inputs (load/reps) and exposes `+ set` for that exercise. Re-tap to lock. Prevents accidental edits while reviewing history.

### Changed
- **Prefill display**: last session's values now appear as HTML `placeholder` text on empty inputs rather than faded italic actual values. Checking a set's done box confirms those values as the record. Prescribed values appear as placeholder fallback when no prior session exists.
- **Per-set prescribed placeholders**: prescribed strings like `"8,10,12"` and `"50,50,50"` are now split per set index so each set sees its own value, not the whole comma-separated string.
- **Column order**: load is now left of reps in the set table (matches the more natural "what weight, how many" read order).
- **Side column removed** from set rows.
- **`type="number"`** on the reps input; `min-width: 4ch` on load and reps inputs.
- **Mobile zoom disabled** via viewport `user-scalable=no, maximum-scale=1`.
- **"repeat last" button removed** — superseded by prefill placeholder behaviour.

### Fixed
- `tokenFromSet` now returns `''` for prefilled sets in syntax mode, keeping the token string clean until the user actually logs values.

## 2026-05-15 r4.7 (import session load fix)

### Fixed
- **Imported sessions now load their exercises.** After restoring a backup, opening session 5 (or any imported session) showed no exercises despite the backup being valid. Root cause: Dexie secondary indexes return empty results for rows inserted via `bulkPut` during restore. Worked around by switching `openSession()` to a full-table scan + in-memory filter for `performances`, `sets`, and `painMarks`.
- **Starting a new session on a day from imported data now creates performances.** Same Dexie-index issue affected the `blocks` and `prescriptions` lookups inside `startSessionForDay()`; converted to full-scan + filter, including the prev-session prefill lookup.
- **`openSession` double-fire**: every navigation was triggering two simultaneous calls, racing each other and intermittently clobbering `activeSessionPerformances` with an empty result. Added an in-flight token; the second call now logs "skipped" and returns. Root cause of the double-fire is not yet identified — the guard sidesteps it.
- **Alpine `Cannot read properties of undefined (reading 'after')` error** when rendering session view. `sessionGroupedBlocks()` could produce two groups with the same `blockId` when performances within a block were non-contiguous in `.order` (after mid-session edits). Groups now carry a unique `key` field (`<index>_<blockId>`); template uses `:key="g.key"`.

### Diagnostic
- Console logging kept in `openSession()` and `startSessionForDay()` until we have more confidence the workarounds hold. Remove after a few clean sessions.

### Postmortem
- Full writeup at `docs/22-postmortem-import-load.md`.

## 2026-05-14 r4.6 (wishlist quick-add floating toolbar)

### Added
- **Floating toolbar (Plan F Feature 1)**: a `+` FAB button in the bottom-right corner expands to reveal a `★` wishlist quick-add action. Tapping it opens a bottom sheet with an exercise name input (autocompletes from the exercise library). Saves directly to `wishlist`; sheet dismisses with a flash toast. Hidden during live session capture view. No schema change.

## 2026-05-14 r4.5 (editable session date, JSON panel fix)

### Added
- **Editable session date (Plan E 1.3)**: clicking ▶ now opens a datetime picker (defaults to now) before creating the session. Supports back-dating for "forgot to log live" and manual reconstruction of pre-app sessions.
- **Edit date on session card**: each session in `#/sessions` has a `date` button that opens an inline date picker. The time-of-day is preserved; `endedAt` shifts by the same delta if present.
- **Edit date in session capture view**: the session header now has an `edit date` button with an inline date picker.
- **JSON panel wired to IndexedDB (Plan E 1.4)**: the debug `json` button now shows the actual stored state via `buildBackup()` by default ("Stored (IndexedDB)" mode). A toggle switches to the original Alpine in-memory view for debugging reactive state.

## 2026-05-05 r4.2 (session polish, Day B alt seed, E2E tests)

### Added
- **Day B alt (home)** seeded under Workout 9.2. 7 blocks: Warmup (bear crawl, shinbox squat, SL hip thrust), Hinge pair (DB RDL + B-stance RDL), KB compound circuit (KB clean/squat, figure 8, heavy bag combo), Rotation (band woodchop), Hips (banded hip CARs), Soccer prehab (Nordic curl + SL glute bridge), Bonus (heavy sled push, optional). Equipment: bench, DBs ≤50, pull-up bar, bands, bag, sled.
- **Playwright E2E test suite** at `tests/e2e/session.spec.js`. 4 tests covering: start session button present, navigation to capture view, set rows in en mode, no JS errors on load. Run with `npx playwright test`. Requires no extra setup - web server auto-starts from `app/`.
- **Session start time** now shows in the capture view header (e.g., `2026-05-05 7:52 AM`).
- **Syntax mode in session capture**: toggle syn in the menubar to collapse reps/load/side columns into a single token input per set. Token format: `{load} {reps}` bilateral, `{load};{reps}` per-side, `{load}!` notable.

### Fixed
- **IDB transaction error** (`Failed to execute 'objectStore'`): reads from `prescriptions` and `exercises` were happening inside the `sessions/performances/sets` transaction which did not include those stores. Moved all reads before the transaction opens.

## 2026-05-05 r4.1 (prefill last cycle's actuals)

### Added
- **Prefill from last session**: when starting a session, the app looks up the most recent completed session for the same day and copies each exercise's reps/load/side values into the new set rows.
- Prefilled values render faded and italic to distinguish them from user-entered data. Any edit (typing, side change, done checkbox) clears the prefill flag and the dimming, confirming the value.
- No schema bump required: `prefilled` is an unindexed boolean on the `sets` record.

### Behavior
- Lookup matches by `exerciseId` within the same `dayId`. If an exercise appears in a new position or was added since last session, its rows start empty.
- If the prescription now has more sets than last session, extra rows start empty.
- If no prior completed session exists for the day, all rows start empty (previous behavior).

## 2026-04-30 r4.0 (sessions: capture flow lands)

### Added
- **Schema v5** for capture: `sessions`, `performances`, `sets`, `painMarks`. Session reset clears all four.
- **Start a session from a Day**: `▶` button on each day card in the Workout view, plus a `▶ start session` button on the Day view. Creates a session and snapshots the day's blocks/prescriptions into performances with denormalized exercise/block names. Pre-creates one set row per prescribed set.
- **Live capture view** at `#/s/{id}`. For each performance:
  - prescribed values shown as the row meta
  - one input row per set: reps, load, side (L/R/both), done checkbox
  - `+ set`, `repeat last`, `$ pain` buttons
  - per-performance notes field
  - pain marks render as colored chips beneath the row
- **Sessions list** at `#/sessions`. Latest first. Status pill (in progress / complete). Tap to open. Trash icon to delete (purges performances, sets, pain marks).
- **End session panel**: tap `end session` to set mood (1-5) and environment (gym / home / park / other). Stamps `endedAt` and flips status to `completed`.
- Menubar adds a `⏱` chip linking to the sessions list.

### Behavior
- Completed sessions are read-only: inputs disable, action buttons hide.
- Capture is autosaved on `change` events; no separate "save" needed.
- Time elapsed renders live for in-progress sessions, static for completed.

### Backlog still open
- **Prefill last cycle** values into new set rows (currently sets start empty; `repeat last` is the workaround)
- **Drop-in blocks** (PT routines droppable mid-session)
- **Pain log alongside last week's records** in the per-exercise view
- **Supersets / paired exercises** (own focused round)
- **Per-exercise history view** with chart and timeline

## 2026-04-30 r3.5 (polish: save & another, duplicate, wishlist)

### Added
- **Save & another** button on the add-exercise form. Commits the current draft and immediately opens a fresh one, focused on the exercise name. Removes the friction of re-tapping `+ exercise` for each row.
- **Duplicate exercise** action (`⎘`) on each prescription row. Copies the prescription with all fields and orders it at the end of the block.
- **Wishlist** primitive. New `wishlist` Dexie store at schema v4. Items are exercise names with optional notes.
  - Add via `★ wishlist` button in the exercise editor (saves the typed name without committing to the block).
  - Or via `+ add` on the wishlist view (`#/wishlist`).
  - Surface in the block view: when wishlist has items, a collapsible `★ from wishlist` panel appears above the prescriptions list. Tap an item to drop it into the current block as a new exercise draft (pre-filling name and notes). Item stays in the wishlist until you remove it.
  - Menubar shows a `★` chip with the wishlist count, linking to the wishlist view.

### Backlog still open
- **Supersets / paired exercises** within a linear block (deferred to its own focused round).
- **Sessions** (capture flow on top of the builder), with drop-in blocks and last-week pain log layered in.

## 2026-04-30 r3.4 (en/syn split, notable as tag, toggle close, optional)

### Changed
- **Syntax / english mode now reshape the form, not just the display.** En mode shows discrete fields with no syntax tokens visible. Syn mode collapses to a single mono token field that covers load, reps, hold, sets, side, notable. Storage stays the same.
- **Notable** rendered as a visual `notable` pill in en mode. `!` only appears in syn mode. Form label dropped the "(renders !)" parenthetical.
- **Click an exercise row's title to toggle the inline editor** open or closed. Edit button removed (the row IS the toggle). Action buttons (`↑ ↓ ×`) stay on the right and don't trigger toggle.
- **Optional block flag** added. Toggle via `★` button on the block row. Optional draft option in the add-block form. Renders with reduced visual weight and an "optional" pill.

### Added
- En mode load: structured into `load type` (lb / plate per side / cable / band / bodyweight) + `load value`. No more `^15`, `(35)`, `band` tokens visible in en mode.
- Syntax-mode parser: best-effort token -> structured fields on save. Fields stay correct so en mode still shows clean values.

### Deferred to next phase
- **Drop-in blocks** (PT-style sets pulled into a session ad hoc): belongs with sessions, will land there.
- **Pain log alongside last week's records**: belongs with sessions and per-exercise history.
- **Wishlist** (single exercises queued up, exposed when designing a new day): real value, but better as part of the session-design loop.

## 2026-04-30 r3.3 (model flattening)

### Changed
- **Domain model: flatten Program + Variant into single Workout entity.** `Workout { id, name, parentId, status, isCurrent }`. Lineage via `parentId`. Days belong directly to Workouts.
- DB schema bumped to v3. `programs` and `variants` tables dropped. `workouts` table added. `days.variantId` becomes `days.workoutId`. Existing data wipes on upgrade and re-seeds.
- Hash routes simplify: `#/w/{id}` replaces `#/p/{id}` and `#/v/{id}`.
- Wizard creates one Workout instead of "Program + Variant".
- Crumbs and labels updated everywhere: "Programs" -> "Workouts".

### Added
- **Fork** action on a Workout view: copies days, blocks, prescriptions into a new Workout linked by `parentId`. Auto-suggests fork name (`9.2 -> 9.3`).
- Workouts list shows lineage (`from Workout 9`) and `current` pill.
- `moveDay` now reorders within group only (Day A among Day As, not across groups). Fixes a r3.2 bug.

### Removed
- `Program` and `Variant` entities. SPEC and docs updated to reflect.
- Implicit redirect from program-card to current-variant. Tapping a workout opens that workout, period.

## 2026-04-30 r3.2 (post-r3.1 review + structural prep)

### Added
- `docs/migration-sveltekit.md`: target stack (SvelteKit + Vercel + Supabase + Dexie), folder structure, step-by-step migration plan, sync model details.
- `docs/user-stories.md`: stories for builder, sessions, history, trackers, sync, import/export. Open questions called out inline.
- `docs/review-r3.2.md`: design + use process walkthroughs (twice each), 18 findings consolidated into a backlog with priorities.

### Changed (app/)
- Inline edit replaces modal for adding/editing exercises. Edit form expands the row in place.
- Inline draft replaces `prompt()` for adding blocks and days.
- Programs view hides archived programs by default. "Show archived" toggle reveals them. Archive / restore buttons per program.
- Empty states are explicit cards with their own CTA, not just dim text.
- Next-step strip surfaces context-aware hints at the top of every view (e.g. "Empty blocks: Squat, Pull").
- Wizard text shows the per-view explanation but is now visually lighter and ordered.

### Identified for next iteration (priorities marked in `review-r3.2.md`)
- "Save and add another" on exercise add (high)
- Copy/duplicate exercise (high)
- Superset / paired exercises within a linear block (high; data model change)
- Verify moveDay reorder scopes correctly within group (high; potential bug)
- Wizard supports custom Day keys (medium)
- Hide JSON button under a settings menu (medium)
- Global FAB for new-session consistency (medium)
- Stronger visual delimiter on inline edit state (medium)

## 2026-04-30 r3.1 (post wired-prototype review)

### Reversed
- `!` notable token stays as user input. r3's removal undone in SPEC, notation.md, decisions.md.

### Fixed (app/)
- Idempotent seed: skip if any program already exists, plus transaction wrap. Removes the duplicate-Workout-9 bug.
- Self-contained app/ folder: styles copied into `app/assets/styles.css`. Fixes styles 404 when serving from a python http.server.
- Hash-routed URLs: every view has a `#/v/{id}/d/{dayId}/b/{blockId}` URL. Back/forward and bookmarks work.
- Save-on-edit feedback: modal closes, list reloads, brief inline confirmation.
- "Reset DB" button in JSON panel for stuck states.

### Added (app/)
- New-program wizard: name -> variant -> Day skeleton picker (A/B/C with movement-pattern blocks) -> create.
- Day skeleton starter: when a Day is created via wizard, blocks are pre-seeded as Warmup + the chosen movement-pattern blocks. Day A: Squat, Push, Anti-Rotation, Plyo. Day B: Hinge, Lunge, Pull, Hips, Rotation. Day C: free.
- Exercise omnibox: type to search/add, replaces dropdown.
- Day list rows show first 2-3 block names as a preview.
- Per-view wizard text in the bottom annotation walks through what to do at each step.
- "Exercise" replaces "Prescription" in UI labels (data field stays Prescription).

## 2026-04-30 r3 (post round-2 review)

### Added
- `app/` folder: wired Template Builder prototype using Alpine.js + Dexie + IndexedDB. First functional code in the project.
- SPEC section 7.5 Trackers: new primitive (injury, asymmetry, skill) linkable to exercises with its own history pivot.
- SPEC 6.2 Ambiguity audit: `;` proposed as the canonical per-side modifier; parser also accepts `:` for backward-compat and normalizes on save.
- SPEC notes on app-wide syntax toggle (menu bar), global floating new-session button, and three-level notes (running log, per-day, per-exercise).

### Changed
- Phasing updated: P1.5 = wire Template Builder; P2 mockup absorbs Trackers, focus view, time goals.
- Notation v3: `!` dropped from input syntax. Notable status is derived from history at render time.
- English mode is strictly discrete: no syntax tokens visible anywhere in english mode.
- Domain model: removed Day Variant entity. Day now has `groupKey` and `isAlt`. Park variant dropped.
- History per exercise chart spec: labeled high/low values on bars, compare-with-other-exercise overlay.
- Syntax toggle moved from per-exercise to app-wide.

### Removed
- Park Day Variant from examples
- Manual `!` notable token

## 2026-04-29 r2 (post round-1 review)

### Added
- `mockup-v1/` snapshot of round-1 mockup, preserved for compare
- `mockup-v2/` round-2 P1 MVP mockup with cut-down view set (~10 views)
- `tests/README.md` describing the planned testing approach
- `docs/notation.md` canonical syntax reference for users
- `docs/decisions.md` ADR-lite log of architectural decisions
- `docs/architecture.md` tech stack rationale
- SPEC sections: Phasing (0), Hierarchy and Numbering (3), Data Storage (5), english/syntax toggle (6.2), prefill+increment Set Entry (7), Feedback Questions Resolved (10), Tests and Docs (15)
- View Inventory now lists each view's phase

### Changed
- Hierarchical numbering throughout: `2.1`, `2.2` instead of "Block 2 / 5"
- Set entry primary method: prefill + chevron increments (1/5/10) + tap-to-type fallback. Custom keypad deprecated.
- Smith machine BSS reclassified as variation of parent BSS in glossary and history examples

### Removed
- Speech capture from MVP. Moved to P4. View kept in v1 for reference.
- Quick edit by prompt from MVP. Moved to P3 pending complexity assessment.
- Custom keypad as primary entry. Deferred or replaced.

### Decisions
- Storage is structured (IndexedDB / Postgres). Markdown is import/export only.
- english/syntax toggle is a per-exercise UI affordance; data is identical in both modes.
- Default english (discrete fields), opt-in syntax (one field).

## 2026-04-29 r1

### Added
- Initial repo scaffolding: README, CHANGELOG, .gitignore
- SPEC.md draft covering domain model, flows, notation grammar, sync, MVP scope
- HTML mockup site under `mockup/` with 20 views and a navigation hub
- Phone-frame design system in `mockup/assets/styles.css`

### Decisions
- Default unit lb
- App is system of record, manual export to markdown
- Day rotation manual with home/gym alt variants
- No nudge at 5x cycle
- Stepped, resumable importer
