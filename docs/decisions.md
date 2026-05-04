# Decisions Log

ADR-lite. Each entry: date, decision, context, alternatives considered, consequences.

## 2026-04-30 r3.3: Flatten Program + Variant into Workout

**Decision:** Eliminate Program and Variant as separate entities. Replace with a single `Workout` entity carrying `parentId` for lineage.

**Context:** User feedback after the wired prototype: "two workouts named Workout 9 on home" (data state plus hierarchy noise) and "click Workout 9 land on 9.2" (silent redirect because Programs aren't directly editable). Their mental model and Obsidian filesystem treats `Workout 9.md` and `Workout 9.2.md` as siblings. The Program -> Variant hierarchy was an imposition.

**Alternatives considered:**
- Keep the hierarchy and make the redirect explicit. Rejected: the hierarchy still doesn't match the user's mental model.
- Treat each markdown file as a Workout, no relations. Rejected: lineage is real and useful for forks.

**Consequences:**
- Schema bumped to v3. `programs` and `variants` tables dropped. `workouts` table added. `days.variantId` becomes `days.workoutId`.
- Hash routes simplify: `#/w/{id}` is the single workout entry. No more `#/p/...` -> `#/v/...` redirect.
- Wizard creates one Workout instead of "Program + Variant".
- Forking a Workout copies its days, blocks, and prescriptions into a new Workout with `parentId` set.
- "Variant tree" becomes a tree of Workouts linked by parentId. Same concept, simpler implementation.
- Migration: existing user data on v2 is wiped on schema upgrade. Re-seeds with two demonstration workouts (Workout 9 archived, Workout 9.2 current).

## 2026-04-30 r3: Drop manual `!` notable token (REVERSED in r3.1)

**Decision:** Remove `!` from input syntax. "First time at this load" is derived at render time by comparing the new value to history of the same exercise/variation.

**Context:** Round-2 review noted `!` is optional and can possibly be dropped.

**Consequences:** Less typing. Fewer ways to get history wrong. Notable badge stays in UI but is computed.

## 2026-04-30 r3.1: Reverse the `!` removal

**Decision:** Keep `!` as user input. App may also auto-suggest it when a load exceeds prior max, but the manual flag stays.

**Context:** User feedback after the wired prototype: "dont remove" `!`. The intent-bearing affordance was lost when we tried to derive everything.

**Consequences:** Token grammar in notation.md restored. Set entry will let the user toggle a notable chip per set. Auto-suggest is a UI prompt, not a silent inference.

## 2026-04-30 r3: `;` as canonical per-side modifier

**Decision:** `;N` for "per side" reps. Parser also accepts legacy `:N` and normalizes to `;` on save.

**Context:** `:` was overloaded with mood (`:)`) and time prefix (`:30s`). Round-2 reviewer flagged the ambiguity.

**Consequences:** Imports re-write per-side tokens; display defaults to `;`. Legacy `:` is still readable in syntax mode.

## 2026-04-30 r3: English mode is strictly discrete

**Decision:** In english mode, no syntax tokens appear in the UI anywhere. Discrete fields only.

**Context:** Round-2 reviewer wanted clean separation between modes; mixing tokens into english cards added noise.

**Consequences:** Two paths through every reading view; data layer unchanged. Storage stays the same; only display switches.

## 2026-04-30 r3: Day Variants removed; Days have groupKey + isAlt

**Decision:** Remove the DayVariant entity. Day gets `groupKey` (e.g. "A") and `isAlt`. The picker groups Day A and Day A alt under a single "Day A" header.

**Context:** Round-2 reviewer asked for the simpler model. Park variant was abandoned.

**Consequences:** One less hierarchy level. Sessions belong to a Day directly. Migration: existing DayVariants flatten into Days with the appropriate groupKey/isAlt.

## 2026-04-30 r3: Trackers as a new primitive

**Decision:** Trackers (injury, asymmetry, skill) are a separate entity with their own history pivot, linkable to Exercises.

**Context:** Reviewer asked to model injury/asymmetry/skill explicitly. Day C diagnostic ISOs and pain logs deserve a real home.

**Consequences:** New TrackerLink table. Pain marks can carry trackerId. New views planned for P2.

## 2026-04-30 r3: Syntax toggle is app-wide

**Decision:** Move syntax toggle from per-exercise chip to a single app-wide control in the menu bar.

**Context:** Reviewer feedback. Per-exercise toggle was overengineered.

**Consequences:** Simpler UI. Per-exercise opt-in syntax dropped.

## 2026-04-30 r3: Global new-session FAB

**Decision:** A floating "+" in the bottom-right starts a new session from any screen.

**Context:** Reviewer wanted a global affordance.

**Consequences:** Long-press opens a menu with new template, new tracker, etc.

## 2026-04-30 r3: Three-level notes

**Decision:** Notes at running-log (top of session, timestamped), per-day, and per-exercise.

**Context:** Reviewer wanted a place for asides without polluting per-exercise notes.

**Consequences:** Session model gets `notes.running[]` and `notes.dayNote`. Per-performance note already exists.


## 2026-04-29 r2: Phased mockup plan

**Decision:** Mockup in 4 phases (P1 MVP, P2 feedback, P3 extended, P4 advanced). P1 cuts the round-1 view set in half (~10 views).

**Context:** Round-1 produced 20 views. Reviewer feedback called for less app interaction and a leaner MVP.

**Alternatives:** Single mockup that already includes everything. Rejected: too much surface area to validate at once.

**Consequences:** Mockup folders proliferate (`mockup-v1/`, `mockup-v2/`, future `mockup-v3/` etc). Compare across phases is easy. Each phase is its own mockup ROUND not its own VERSION; the SHIP version is the merged set when the app builds.

## 2026-04-29 r2: Storage is structured, not markdown

**Decision:** IndexedDB on device, Postgres in cloud. Markdown only for import/export.

**Context:** Reviewer asked whether markdown should be the data layer.

**Alternatives:** File-system-of-record like Obsidian. Rejected because cross-exercise queries, conflict resolution, and per-record sync all require an index.

**Consequences:** Round-trip import/export is a separate concern. Importer is stepped and lossy-tolerant. Export is byte-perfect to the modern markdown format.

## 2026-04-29 r2: Set entry uses prefill + chevrons, not custom keypad

**Decision:** Default in-session entry: prefill last cycle's value, chevron increments (1/5/10), tap-to-type fallback to OS numeric keyboard, repeat-last button.

**Context:** Reviewer questioned whether to block OS keypad or pull a custom one. Underlying tenet: minimize taps.

**Alternatives:** Custom keypad with notation tokens (round 1). Felt heavier than necessary for the most common case (last cycle's value is correct).

**Consequences:** Custom keypad UI is deferred. Notation tokens are still typed via the syntax toggle on a prescription, not via on-screen pad.

## 2026-04-29 r2: Hierarchical numbering 2.1, 2.2

**Decision:** Use dotted form `<block>.<exercise>` everywhere. `2.1` is "block 2, exercise 1".

**Context:** Reviewer found the round-1 "Block 2 / 5" sub-numbering confusing.

**Consequences:** Easier verbal reference ("two-one"), exports are tidier, list view rows align cleanly.

## 2026-04-29 r2: english / syntax toggle

**Decision:** Two presentation modes for prescriptions. english = discrete fields; syntax = one token field. Default english, opt-in syntax per exercise. Storage identical.

**Context:** Reviewer asked whether syntax should be import/export only. Power users want fast typing; new users need scaffolding.

**Consequences:** Slight UI complexity. Worth it for muscle memory once locked in.

## 2026-04-29 r2: Speech and quick-edit deferred

**Decision:** Speech-to-text moves to P4. Quick edit by prompt moves to P3.

**Context:** "Worth complexity?" question on quick-edit. Speech complexity (iOS standalone) too high for early ROI.

**Consequences:** P1 stays lean. Reassess once core loop is real and we know how often template changes are needed mid-session.

## 2026-04-29 r1: lb default

**Decision:** lb as default weight unit.

**Consequences:** kg is selectable in Settings. Display follows user choice. Storage records both value and unit.

## 2026-04-29 r1: App is system of record

**Decision:** App is the source of truth. Manual export to markdown. No two-way sync with Obsidian.

**Consequences:** Obsidian becomes a backup/archive target. Round-trip exists via importer for migration only.

## 2026-04-29 r1: Importer is stepped and resumable

**Decision:** Paste -> parse preview -> per-line review -> commit, with draft save at every step.

**Context:** Source data is messy. PRX 1 alone is 50K lines.

**Consequences:** Importer is a P3 feature. Until then, manual entry is fine for fresh sessions.
