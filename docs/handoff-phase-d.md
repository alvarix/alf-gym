# Handoff: post-Phase C — next priorities

Session-handoff after Phase C ships. Read `docs/builder-session-export.md` first — it is the complete implementation reference for Phase A/B. Phase C (in-place edits) is now implemented but **not yet committed**.

---

## Repo state at handoff

```
Branch:    master
Status:    3 commits ahead of origin/master, not pushed. Phase C code present but uncommitted.
Working:   dirty — app/app.js, app/index.html, tests/e2e/edit-in-session.spec.js (new),
           tests/e2e/partial-session.spec.js (race-condition fix), docs/ untracked

Phase A–C commits (not pushed):
  231c2ed feat(session): add new block mid-session with template/fork/session scope
  1fe2d49 feat(session): add and remove exercises mid-session with template/fork/session scope
  8e8a3e2 feat(io): full IDB backup and restore with one-cycle undo
```

30 Playwright tests pass. The originating plan is at:
`/Users/alvarsirlin/.claude/plans/opus-builder-session-export-magical-snail.md`

---

## Priority order for next work

### 1. Markdown importer (NOW REQUIRED — spec first)

Previously P3 / nice-to-have. **Upgraded to required.** This is now a prerequisite before the project is considered shippable.

**What it is:** An import path that reads a structured Markdown file (e.g. exported from Notion, a text editor, or hand-written) and populates the `workouts / days / blocks / prescriptions` table hierarchy. The IDB backup/restore (Phase A) handles machine-to-machine transfers of exact state; the Markdown importer handles human-authored programme specs being brought into the app.

**Spec first.** Before any code: write `docs/importer.md` as a complete spec covering:
- Markdown grammar (what heading levels map to what entities, how prescription fields are encoded)
- Parse strategy (line-by-line state machine vs. AST)
- Conflict/merge behaviour (append-only? replace? match by name?)
- Error handling and user feedback
- UI entry point (likely an "import from markdown" button near the existing backup panel)
- Example input/output pair

Do not start implementation until the spec is reviewed and approved.

### 2. Pocketbase instead of Supabase

The original plan deferred sync to "Supabase eventually." That decision is now reversed: **use Pocketbase** instead.

**Why Pocketbase:**
- Self-hosted, single binary — no managed-service dependency or billing
- REST + realtime subscriptions out of the box
- Schema defined in the admin UI or via migrations
- Better fit for a personal/small-team app where Supabase's row-level security model adds overhead without benefit

**Impact on existing docs:** `docs/db-spec.md` was written with Supabase in mind (RLS, `auth.uid()`, etc.). Before building sync, rewrite or annotate that spec for Pocketbase's collection/rule model.

**Migration path:**
1. Spin up a local Pocketbase instance
2. Define collections that mirror the existing Dexie schema (workouts, days, blocks, prescriptions, exercises, sessions, performances, sets, painMarks, trackers, wishlist, meta)
3. Build a one-way push: IDB → Pocketbase on demand (not a live sync initially)
4. Add conflict resolution later

Do not start until `docs/importer.md` is shipped (importer is higher priority).

### 3. Drop blocks for tags on exercises — decision needed

This is the deferred architectural question flagged in Phase C.

**The question:** The current model has `blocks` as named sections inside a day (Warm-up, Main, Cooldown, etc.). Some blocks exist purely to group exercises by category. An alternative model: remove the concept of numbered-category blocks and instead tag exercises directly (e.g. `exercise.tags: ['warmup', 'plyometric']`), letting the session view group by tag rather than by block.

**Alvar's note for next thread:** This is an open question, not a decided change. Revisit it after the importer ships. The decision affects both the data model and the Markdown importer grammar, so it should be locked in before the importer spec is finalised.

**Current state:** No action taken. `blocks` table and all denormalized `blockName/Type/...` fields on performances remain as-is.

---

## Open items from prior handoffs (unchanged priority)

- **Trackers UI** — data layer present, P2. No UI built.
- **Pocketbase sync** — see above; was "Supabase sync", now Pocketbase.

---

## Validation steps before declaring Phase C done

(For the thread that commits Phase C — not yet done.)

1. `npx playwright test` — all 30 tests green.
2. Start dev server (`python3 -m http.server 8000` from `app/`) and manually smoke:
   - Start a session for Day A.
   - Edit an exercise's prescribed sets → "session only" → reload session → value persists; navigate to builder → original prescription unchanged.
   - Edit again → "to template" → builder reflects change.
   - Edit again → "fork" → new workout appears in the workouts list; session now points there.
   - Edit a block header's type from linear to circuit → confirm rounds field appears.
3. Run a full backup → wipe IDB → restore → confirm edited values survived.
4. Suggest commit message:
   ```
   feat(session): edit prescriptions and blocks mid-session with template/fork/session scope
   ```

---

## Style and convention reminders

- Never commit unless Alvar explicitly says to.
- Conventional commits, brief, no emojis, no attribution.
- Suggest tests, README, CHANGELOG when appropriate.
- Atomic commits per phase.
- Suggest a database backup before destructive actions (use the in-app backup button).
