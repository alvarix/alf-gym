# alf-gym Spec

A living document. See CHANGELOG.md for dated changes.

## 0. Phasing

Build in phases. Each phase has its own mockup pass, then code.

| Phase | Scope | Folder |
|---|---|---|
| P1 mockup | MVP, ~10 views | `mockup-v2/` (round 2) |
| P1.5 wire | Wire the Template Builder to surface design issues | `app/` (round 3, current) |
| P2 mockup | Focus view, circuit detail, variant tree, sync detail, time goals, trackers | `mockup-v3/` |
| P3 | Importer, search, charts, quick-edit | later |
| P4 | Photos, advanced diagnostics, multi-user. Speech reconsidered if requested | later |

Round-1 mockup lives at `mockup-v1/`. Round-2 lives at `mockup-v2/`. Round-3 starts the wired app at `app/`. Round-3 mockup updates for views beyond the builder are deferred until the wired builder reveals what needs to change.

## 1. Goals

A mobile-first PWA for tracking gym sessions with offline-first behavior, fast in-session capture, and history that surfaces last cycle's output as you log this cycle's. Respect the existing notation conventions and import the historical Workouts vault.

Core tenet: as little app interaction as possible. Every screen earns its place. Default behaviors should make the right thing happen with no taps where possible.

## 2. Glossary

- Program: a numbered training block (Workout 9, PRX 2). One program runs ~5 cycles before redesigning.
- Variant: a minor revision within a program (9, 9.2). Variants share lineage and history.
- Day: A / B / C within a variant (Front / Back / Skills+Diagnostics). Days can have alts as siblings (Day A, Day A alt, Day A home), grouped under one section in the picker via `groupKey`.
- Tracker: a non-exercise primitive linked to one or more exercises. Three kinds: injury, asymmetry, skill. Has its own history pivot.
- Session: one logged workout instance.
- Block: a numbered subsection of a Day (Warmup, Anchor, Anti-rotation, etc.). Blocks are what get the top-level number. Type: linear or circuit.
- Linear Block: exercises completed one at a time, all sets done before moving on.
- Circuit Block: a group of exercises run in rounds, no rest between exercises within a round, rest between rounds.
- Exercise: the canonical movement (BSS). Stable identity across all instances and variations.
- Variation: a child of an exercise. Smith machine BSS is a variation of the parent BSS. Tempo BSS with DBs is another variation. All variations share the parent's history pivot.
- Prescription: the exercise's plan inside a template (sets, reps, tempo, side scheme, cues, alts).
- Performance: what actually happened in a session for a prescription.
- Set: one logged unit of performance with weight, reps, side, RPE, notes.
- Pain Mark: a logged pain event tied to a session. Severity 0-10, side, region.

## 3. Hierarchy and Numbering

Numbering uses dotted form: `block.exercise`. So `2.1` is "block 2, exercise 1". This replaces the prior "Block 2 / 5" wording everywhere. The Day-level template defines the block list once; sessions inherit that ordering.

Editing the block list is one level above editing exercises:
- Day-level template editor: name and order blocks for a Day Variant. Block type. Round count for circuits.
- Block-level editor: prescriptions inside the block.
Both live in Template Builder; you switch level via breadcrumb.

## 4. Domain Model

```
Workout 1..n Day 1..n Block 1..n Prescription
                                       |
                                       +--> Exercise (1..n Variation)

Workout { id, name, parentId, status, isCurrent, createdAt }
  parentId points to the previous revision in lineage. null = root workout.

Day.groupKey: string (e.g. "A") - groups Day A and Day A alt in the picker
Day.isAlt: bool

Block.type: linear | circuit
Block.rounds: int (only for circuit)
Block.restBetweenRoundsSec: int

Prescription.order: int
Prescription.sideScheme: bilateral | unilateral-L-first | unilateral-R-first | alternating
Prescription.tempo: { eccSec, pauseBotSec, conSec, pauseTopSec }
Prescription 0..n TrackerLink (links a tracker to this prescription)

Tracker { id, name, kind: injury | asymmetry | skill, status, severity?, side?, notes }
TrackerLink { trackerId, exerciseId, prescriptionId? }

Session belongs_to Day, which belongs_to Workout (no Program/Variant entities)
Session 1..n Performance
Session.notes: { running: [LogEntry], dayNote: string }
Performance references Prescription
Performance.notes: string (per-exercise note)
Performance 1..n Set
Set: { reps, load, loadUnit, side?, holdSec?, tempo?, rpe?, notes }

LogEntry { ts, text }
PainMark: { side, region, severity, sessionId, performanceId?, trackerId?, ts }
MoodMark: { score, sessionId, ts }
EnvMark: { kind: gym | home | park | other, sessionId }
```

Notable status (`!`) is **derived** at render time by comparing the set's load to history of the same exercise/variation. No manual flag is stored.

## 5. Data Storage

Storage is structured (IndexedDB on device, Postgres in cloud). Markdown is import/export format only, not the data layer.

Why not markdown as storage:
- Querying history across exercises and variations needs an index, not file scans.
- Conflict resolution on sync needs per-record revisions, not whole-file diffs.
- The notation grammar maps cleanly to typed fields; storing it as text would force re-parsing on every read.

What markdown is used for:
- Import: legacy Workout vault and freeform notes, via the stepped importer.
- Export: per-session human-readable artifact and full-vault round-trip.

## 6. Notation Grammar

The legend is canonical. Stored as typed fields, displayed back in this notation in syntax mode and exports.

### 6.1 Legend (v3.1)

- Weight: `115` = total bar weight. `(35)` = plate per side. `!` = notable, first time at this load (kept as user input).
- Reps: `8` = bilateral reps. `;8` = reps per side. `:` is also accepted as legacy per-side and normalized to `;` on save.
- Sets: `-3` or `-III` = number of sets.
- Prefixes: `^` = cable stack weight (`^15` is cable level 15, not pounds).
- Pain: `$3 L R back` = severity 3, lower-right, back of area. Severity 0-10.
- Mood: `:)` and variants. Numeric: `8:)` or `7.5:)`.
- Plus activity: `+ bike`, `+ box`. Auxiliary work outside the main block.
- Time hold: `30s` is seconds. Combine with `;` for per-side: `30s;`.

Examples:
- `95!;8-3` = 95 lb (notable), 8 reps per side, 3 sets
- `0;8,35!;6` = bodyweight x 8 per side, then 35 lb (notable) x 6 per side
- `^15;10-2` = cable stack 15, 10 reps per side, 2 sets
- `30s;-3` = 30-second hold per side, 3 sets

### 6.2 Ambiguity audit

Resolved in v3:
- **Per-side modifier:** `:` was overloaded with mood and time markers. Per-side now uses `;`. Imported `:N` is normalized to `;N` for rep/load contexts; `:)` and `:30s` (time) keep the colon for backward compatibility in display, but parser treats them via context.
- **Notable token (`!`) kept as user input** (reversed in r3.1). Marking notable manually is fast and intent-bearing; the auto-derive plan would have erased that affordance. App may also auto-suggest `!` when a load exceeds prior max.
- **Weight unit on a number alone:** disambiguated by prescription's `loadUnit` (lb default). `^N` always means cable. `(N)` always means plate per side.

### 6.3 English mode is strictly discrete

In english mode, no syntax tokens appear in the UI anywhere. Set values render as separate cells (weight, reps, side scheme is part of the prescription header). History rows render numeric values plus an optional "per side" label.

Syntax mode renders the canonical token form. Toggle is **app-wide**, exposed in the menu bar.

## 7. Set Entry

Default behavior optimizes for "no taps when last cycle's value is right":

1. Each set cell is **prefilled** with last cycle's value for that set.
2. **Up / down** chevrons next to the number adjust by the active increment.
3. **Increment switcher** sits next to the cell with three options: `±1`, `±5`, `±10`. The user picks once per exercise; the choice persists for that exercise.
4. **Tap the number** to type a custom value (numeric keyboard).
5. **Repeat last** button commits the set unchanged in one tap.

This replaces the custom keypad as the primary entry method. Keypad pad UI is deferred (P3+); chevrons + increments cover 90% of cases.

For circuits, each round-cell follows the same prefill+chevron pattern.

## 7.5 Trackers

A tracker is a non-exercise primitive with its own history pivot. Three kinds:

- **Injury**: tracks an active or chronic issue (L hip, R shoulder). Has severity, status (active, monitoring, resolved), affected side, region, notes timeline.
- **Asymmetry**: tracks an L vs R imbalance metric over time (e.g. SL balance hold time, BSS load tolerance). Records two-value entries (left, right) per session.
- **Skill**: tracks a discrete or graded ability (handstand wall hold time, capoeira au quality 1-5). One value per session.

Trackers can be linked to one or more exercises via `TrackerLink`. When the user logs a relevant exercise:
- Injury linked → pain marks on that exercise auto-roll up to the injury tracker
- Asymmetry linked → set entry captures L and R separately, fed into asymmetry timeline
- Skill linked → quick scoring chip appears on the prescription card

Trackers also stand alone: Day C diagnostic ISOs (single-leg wall sit hold time L vs R) are pure tracker entries with no parent exercise.

Trackers list view, tracker detail view, and "link to exercise" affordance ship in P2 mockup.

## 8. Core User Flows (P1 only)

### 8.1 Start a session
Home -> Start session -> Day picker -> Day Variant picker -> session created with auto-date and auto start-time, scaffold prefilled from last matching session.

### 8.2 In-session capture (list view, default for P1)
Whole workout visible as numbered steps. Hierarchical numbering: `1.`, `1.1`, `1.2`, `2.`, `2.1`, etc. Active exercise expands inline; rest collapse to one line.

P1 ships only the list view. Focus view ships in P2.

Each row shows: number, exercise name, prescription summary (numeric in english, tokens in syntax mode), last-cycle ghost, status. Tap to expand.

Expanded row shows set cells (prefilled), `± increment switcher`, action chips: `pain`, `note`, `swap`, `repeat last`.

Circuits render inline as one card with round counter and per-round cells. Dedicated circuit view ships in P2.

**Notes at three levels:**
- **Running log** at top of session: timestamped entries appended throughout (mid-session asides, environment notes, observations). Pinned tappable.
- **Per-day note**: one freeform field for the whole session.
- **Per-exercise note**: existing per-prescription freeform.

**Global new-session button**: a floating `+` in the bottom-right is present on every screen except the active session itself. Single tap starts a new session via the Day picker. Long-press opens a menu (new template, new tracker, etc.).

**App-wide syntax toggle**: a small `en | syn` chip in the menu bar / header toggles presentation across the whole app. Storage is unchanged; only display switches.

### 8.3 End session
End -> auto end-time -> mood prompt (5 emoji) -> environment chip (gym, home, park) -> session committed.

### 8.4 Auto copy last
On Day start, prior session of same Day on same Variant is copied into the editable scaffold. Setting toggles fallback to "any variant in lineage".

### 8.5 Templates
Browse programs and variants. Open a variant in Template Builder.

Template Builder has two levels: **Day** (block list) and **Block** (prescriptions). Breadcrumb switches.

P1 builder ships: add/remove/reorder blocks, set block type linear or circuit, add/remove/reorder prescriptions, edit prescription tokens. P2 adds time goals, estimator, progress bar.

### 8.6 History
- Overview: list of all sessions with filters (program, variant, day, env, date). Tap a row to see day detail.
- Day detail: full session view with all sets, painmarks, notes. Delete here.
- Per exercise: chart of working-set load over time, variations toggle, timeline list.

P1 history filter UI is shown but minimal: program, variant, env, date. Search is P2.

### 8.7 Variant tree
Visualize program lineage. Programs branch into variants, variants branch into day variants.

P1 mockup: text tree. P2 mockup: optional graph view. Tree always available as a quick reference.

### 8.8 Settings
Units, default view, export. Sync details are linked but the dedicated sync screen ships P2.

## 9. View Inventory by Phase

| File | View | Phase |
|---|---|---|
| home.html | Home / today | P1 |
| day-picker.html | Day picker (Day, then Day Variant) | P1 |
| session-list.html | In-session list view (default) | P1 |
| exercise-detail.html | Exercise detail (cues, alts, branch) | P1 |
| history-overview.html | History overview with filter UI | P1 |
| history-day.html | Single session detail with delete | P1 |
| history-exercise.html | History per exercise (chart, variations) | P1 |
| templates-list.html | Templates list | P1 |
| template-builder.html | Template builder, Day + Block levels | P1 |
| settings.html | Settings + inline export | P1 |
| variant-tree.html | Variant tree | P2 |
| session-focus.html | Single-exercise focus view | P2 |
| circuit-block.html | Dedicated circuit detail | P2 |
| sync.html | Sync status detail | P2 |
| importer-1-paste.html | Importer step 1 | P3 |
| importer-2-preview.html | Importer step 2 | P3 |
| importer-3-review.html | Importer step 3 | P3 |
| importer-4-commit.html | Importer step 4 | P3 |
| quick-edit.html | Quick edit by prompt | P3 (worth complexity? deferred) |
| speech-capture.html | Speech capture | P4 |

## 10. Feedback Questions Resolved

From round 1 review:

- **MD as data layer?** No. Storage is structured. MD is import/export only. (See section 5.)
- **Sub-numbers confusing.** Switched to `2.1`, `2.2` dotted form. (See section 3.)
- **Block type linear: is this the numbered blocks?** Yes. Blocks are the numbered subsections of a Day. The type (linear or circuit) is how they execute. Editing the block list happens at the Day level in Template Builder. (See section 3.)
- **Custom keypad: block OS keypad or pull custom?** Neither. Replaced with prefill + chevron increments + custom tap fallback to OS numeric keyboard. (See section 7.)
- **Quick edit prompt worth complexity?** Deferred to P3. Re-evaluate after P1/P2 ship and we see how often template edits are needed mid-session.
- **Speech capture.** Removed. Re-evaluate as P4 if hands-free becomes a real ask.
- **Syntax only for import/export, or integrated?** Integrated with toggle. Default english, opt-in syntax field. (See section 6.2.)
- **Smith machine BSS: variant of BSS.** Corrected. Parent is BSS; Smith machine BSS, Tempo BSS with DBs, etc. are variations. (See section 2.)
- **Quick access to history from any screen?** Yes, addressed by exercise-detail showing a "full history" link, plus tapping any exercise name anywhere opens its history page. P2 adds a global search affordance.
- **Time goals in template builder.** P2.
- **History filter UI / day detail / delete.** P1 (mocked). Search is P2.
- **Month/year chart view.** P2.

## 11. Sync Model

Local-first. IndexedDB is the source of truth on device. Network never blocks.

Cloud sync (Supabase recommended):
- Auth: email magic link, single-user only at v1
- Per-record `updatedAt` + `syncRev`. Last-write-wins with daily snapshot
- Outbox queue: writes hit IndexedDB, queue for upload, service worker drains when online
- Manual export at any time: JSON + markdown per session

## 12. Tech Stack

- Frontend: Alpine.js for reactivity, htmx for sync routes
- Storage: Dexie (IndexedDB), Zod at storage boundaries
- Service worker: Workbox
- Backend (sync only): Supabase
- Build: Vite
- PWA: manifest, icons, install prompt

## 13. PWA Requirements

- Installable on iOS Safari and Chrome
- Offline read of all data
- Offline write to today's session
- Background sync when supported, fallback to on-launch flush
- Wake lock during active session
- Large hit targets, high contrast, big numerals

## 14. UI Principles

- Aim for zero taps when defaults are correct: prefill last cycle, increment chevrons, repeat-last
- Numbered hierarchy: `2.1`, `2.2` everywhere
- english/syntax toggle preserves data, swaps presentation
- Pain and mood are first-class affordances
- Gestures: swipe to mark complete, swipe to undo

## 15. Tests and Docs

Both folders exist from project inception so the discipline carries forward:

- `tests/`: future unit and integration tests for the app code. Pre-build: a `README.md` describes the planned approach (Vitest for units, Playwright for E2E PWA flows).
- `docs/`: durable documentation. `notation.md` is the canonical syntax reference for users. `decisions.md` is the ADR-lite log. `architecture.md` covers tech choices and tradeoffs.

## 16. MVP Scope (P1)

In:
- Programs, variants, days, day variants, blocks, exercises, prescriptions, sessions, performances, sets
- Linear and circuit block types (circuits inline in list view; dedicated view P2)
- Auto date/time, auto copy last, list view only
- Set entry: prefill + chevron increments + tap-to-type + repeat-last
- english/syntax toggle on prescriptions
- Pain marks, mood, env
- Modern-format read of templates; legacy importer is P3
- History overview with filter UI, history day with delete, history per exercise (chart + variations)
- Templates list and Template Builder (Day + Block levels)
- Local-only storage, JSON + markdown export

Out (deferred):
- Focus view, dedicated circuit view, variant tree visual graph, sync detail screen (P2)
- Importer, search, charts month/year, quick edit by prompt (P3)
- Speech, photo/video, advanced diagnostics (P4)

## 17. Decisions Log

- 2026-04-29 r1: lb default. App is system of record. Day rotation manual. Stepped importer. Circuits first-class. Quick-edit-by-prompt with 3 save scopes.
- 2026-04-29 r2: Phased mockup approach (P1-P4). Cut MVP views by half. Hierarchical 2.1 numbering. Set entry switches to prefill + chevron increments. english/syntax toggle. Speech removed (P4). Quick-edit deferred (P3). Smith machine BSS reclassified as variation of parent BSS. Storage is structured; MD is import/export only. Tests and docs scaffolded from start.
- 2026-04-30 r3: Notation simplifications. `!` dropped (notable derived). `:` for per-side replaced by `;` (parser accepts both, normalizes to `;`). English mode shows zero syntax tokens. Day Variants entity removed; Days have `groupKey` and `isAlt` instead. Park variant abandoned. Trackers (injury, asymmetry, skill) added as a new primitive with own history pivot, linkable to exercises. Syntax toggle moves to app-wide menu bar. Global floating new-session button added. Notes at three levels (running log, per-day, per-exercise). History chart: high/low value labels and compare-with-other-exercise overlay. Next concrete work: wire Template Builder.
- 2026-04-30 r3.1 (post wired-prototype review): Reverse the `!` removal. `!` stays as user input. Bug fixes in wired Template Builder: idempotent seed (no duplicate programs), self-contained app/ folder (no parent-dir references), hash-routed URLs for back/forward, omnibox for exercise selection (replaces select), Day skeleton starter templates (Day A: Warmup, Squat, Push, Anti-Rotation, Plyo; Day B: Warmup, Hinge, Lunge, Pull, Hips, Rotation), "new program" wizard, "exercise" replaces "prescription" in UI labels, lb units in seed.
- 2026-04-30 r3.2 (post-r3.1 review): Inline edit replaces modal for exercises. Inline draft replaces prompt() for blocks and days. Hide archived programs by default. Empty states with explicit CTA cards. Context-aware next-step strip on every view. SvelteKit migration plan documented. User stories written. Design + use process review (twice each) captured 18 findings.
- 2026-04-30 r3.3 (post-r3.2 review): **Flatten Program + Variant into a single Workout entity.** The Program/Variant distinction was conceptual overhead the user does not have; it caused two confusions ("two workouts named Workout 9" and "click Workout 9 land on 9.2"). New shape: `Workout { id, name, parentId, status, isCurrent }`. Lineage by `parentId`. Days now belong directly to Workouts. Routes change from `#/p/{id}` and `#/v/{id}` to `#/w/{id}`. Wizard creates a single Workout. New `fork` action on a Workout copies its days/blocks/prescriptions into a new Workout linked by `parentId`. Auto-suggest fork name (`9.2 -> 9.3`).

## 18. Open Questions

1. For circuits, should rep schemes be per-round (variable) or fixed across rounds? Default fixed; allow per-round override.
2. Day Variant: always its own template, or sometimes a session-time override? Currently: if recurring, make it a Day Variant; if one-off, edit in session.
3. For the variant tree visualization in P2, graph or expanded text tree? Text tree is shipping in P1 already.
4. For the markdown export, do we aim for byte-perfect round-trip with the importer, or human-readable with best-effort import? Currently aiming for round-trip.
5. Should "branch new variation" be auto-suggested when a session-only swap is done repeatedly? Pattern detection ships P3+.
