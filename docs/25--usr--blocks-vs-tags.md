# 25 — Blocks-as-UI, tags-as-data — Tasks

**Estimated effort:** 1–2 hours decision; 8–14 hours implementation.

Reframed from earlier "drop blocks for tags." Alvar's observation: **blocks are useful in planning but rigid in editing.** Therefore the working model becomes:

- **Data layer:** tags on exercises (or prescriptions)
- **UI layer:** render groupings *projected from tags* at display time
- **Mid-session edit:** retag instead of restructure

## The hypothesis being tested
- [ ] Blocks-as-UI eliminates the friction of mid-session block delete / add / move
- [ ] Cross-cutting filtering ("all my plyo work") becomes free, because tags are query-friendly
- [ ] Planning is no harder — the importer still parses headings, but headings now produce tag assignments instead of `blocks` rows

## Decisions needed (architectural)
- [ ] What carries order? Currently `block.order` + `prescription.order`. Without blocks, ordering becomes `prescription.dayOrder` (a per-day integer).
- [ ] Where do circuit attributes live? Currently block-level (`rounds`, `restBetweenRoundsSec`). Options: on the first exercise in the group, on a sibling "group hint" record, or on the tag itself if a tag carries metadata.
- [ ] Are tags on `exercises` (global to library) or on `prescriptions` (per-day, per-workout)? Probably prescriptions — same exercise can be "warmup" in one day and "main" in another.
- [ ] How are tags entered? Free text with autocomplete, or a controlled vocabulary?
- [ ] Migration path for existing data (Workout 9.2, ~30 blocks)
- [ ] Sequencing vs pocketbase sync — do this before or after?

## Implementation slices (only after decisions above)
- [ ] Schema bump: `prescriptions.tags: string[]`, `prescriptions.dayOrder: int`, optional `prescriptions.groupHint: { rounds, restBetweenRoundsSec, optional }`
- [ ] Migration: derive tags from existing block names, dayOrder from block.order + prescription.order
- [ ] Session view rewrite: `sessionGroupedBlocks()` becomes `sessionGroupedByTag()` projecting from tags
- [ ] Mid-session flows: replace "add block" / "remove block" with "retag selection" / "create new tag"
- [ ] Importer (`docs/27--*--md-import.md`): heading → tag mapping
- [ ] Denorm cleanup on `performances`: tags replace `blockName/blockType/blockRounds/...`
- [ ] Builder UI: tag chips on prescription rows; collapsible groups by tag

## Ruled out
- Pure additive (blocks + tags coexist) — Alvar's framing is "blocks are UI, not data," so the data model has to actually drop blocks. Hybrid would re-introduce the editing rigidity.

## Feedback
(fill in after reading)
