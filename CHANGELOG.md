# Changelog

All notable changes to alf-gym are recorded here. Newest entries on top.

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
