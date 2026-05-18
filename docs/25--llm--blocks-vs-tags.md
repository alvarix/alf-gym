# 25 — Blocks-as-UI, tags-as-data — LLM spec

**Estimated effort:**
- Decision (this doc + a follow-up design doc): 1–2 hours
- Implementation: 8–14 hours

Companion: `docs/25--usr--blocks-vs-tags.md`.

## Reframing

Earlier framing: "should we drop blocks for tags?" — three options (status quo, additive, replace).

Alvar's refined framing: **blocks are useful in planning but rigid in editing.** They model what a workout *looks like* but not how you actually move through it on the day. Therefore the answer is not "blocks vs tags" but "**blocks are a UI projection over tagged data.**"

This collapses the option space:
- Tags become the data primitive (on prescriptions, not exercises — same exercise tags differently in different contexts)
- Blocks become a *render-time* grouping, projected from tags + order
- Planning still feels like blocks (the UI shows them); editing is just retagging
- Cross-cutting filtering ("all plyo across all workouts") is a free side-effect

## Goal

Decide on this reframing, then write a design doc that locks down the structural questions (order, circuit attributes, migration). Implementation is a third phase.

## Architecture baseline (verified)

Current state — blocks-as-data:
- `blocks` table: `++id, dayId, name, type, optional, rounds, restBetweenRoundsSec, order`
- `prescriptions.blockId` foreign key
- `performances` denormalises `blockId, blockName, blockType, blockOptional, blockRounds, blockRestBetweenRoundsSec`
- Session view groups by `blockId` in `sessionGroupedBlocks()` (`app/app.js:345+`)
- Mid-session add/remove/edit-block flows scope-aware (`commitSessionAddBlock`, `openEditBlock`, `commitEditBlock`)
- Markdown importer (`docs/27--*--md-import.md`) plans heading → block mapping
- Session-only blocks use string sentinel ids — already an oddity that this refactor would eliminate

Target state — blocks-as-UI:
- `prescriptions.tags: string[]` (e.g. `["warmup"]`, `["plyo", "main"]`)
- `prescriptions.dayOrder: integer` (replaces the implicit `block.order + prescription.order` pair)
- Optional `prescriptions.groupHint: { rounds?, restBetweenRoundsSec?, optional? }` for what blocks currently carry — attached to the first prescription of a tagged group
- Session view groups by tag in render order, deriving group headers from the tag names

## Plan

| # | Phase | Effort | Risk | Blocking on |
|---|-------|--------|------|-------------|
| 1 | Approve the reframing | 0.5h | — | Alvar |
| 2 | Design doc — pin down order, circuits, migration | 1h | — | phase 1 |
| 3 | Schema bump + migration script | 2–3h | medium — must not lose data | phase 2 |
| 4 | Session view rewrite | 2–3h | low | phase 3 |
| 5 | Mid-session flows rewrite | 2–3h | medium — fewer concepts to delete, more to retag | phase 3 |
| 6 | Importer adjustment (heading → tag) | 1–2h | low | phase 3 |
| 7 | Builder UI: tag chips, collapse by tag | 1–2h | low | phase 3 |
| 8 | Denorm cleanup on performances | 1h | low | phase 3 |

Phases 3–8 land as a single coordinated PR, since the schema bump breaks everything in flight.

## Open questions

1. **Sequencing vs pocketbase**: migrating Dexie once then mirroring to pocketbase = clean. Mirroring blocks to pocketbase then migrating both = double work. Strong argument for doing this *before* pocketbase, but it delays sync.
2. **Tag vocabulary**: free text or controlled? Free text scales to user habits; controlled prevents `warm-up` / `warmup` / `Warm-up` divergence. Recommend free text with a normalisation step on save (lowercase, trim, collapse whitespace) and an autocomplete from existing tags.
3. **Circuit attributes**: cleanest home is a per-prescription `groupHint` on the first prescription in a tagged group, BUT this couples display to data order. Alternative: a `groups` mini-table `{ dayId, tag, rounds, rest, optional }` keyed by `(dayId, tag)`. The mini-table is more orthogonal but adds an indirection.
4. **Multi-tag exercises**: a prescription tagged `["warmup", "plyo"]` appears under which group at render time? Pick a primary-tag convention, or render under each (duplicated rows) — the latter feels wrong for capture. Recommend: tags are an *ordered list*, first tag is the primary group.
5. **Backwards compatibility for in-flight sessions**: a session started before the migration carries denormalised block fields on its performances. The migration can leave those intact (they're snapshots) and only convert the template side. Worth confirming.

## Risk assessment

- **Mid-session edit rigidity disappears** ✓ — retagging an exercise is a single field write, no block hierarchy to restructure.
- **Importer grammar** simplifies (headings just emit tags) — but the doc 27 plan needs an edit.
- **Planning UX** is the question to watch. Tags are a more abstract mental model than blocks. The UI must hide that abstraction — tag groups should *look* like blocks when designing.
- **Migration risk** is real but bounded. The data is small (~30 blocks, ~150 prescriptions in the canonical workout). A migration script with a one-cycle undo (already in place for restore) covers it.

## Recommendation

**Approve the reframing in principle.** Then:
1. Write phase 2's design doc (a `25.1--llm--design.md`) to nail the order/circuit/migration mechanics
2. Do not start implementation until the design doc is approved
3. Sequence ahead of pocketbase if possible; if pocketbase is imminent, defer until after sync to avoid two migrations

The decision is no longer "tags yes/no" — it's "when do we do this." The framing is correct.
