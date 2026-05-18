# 27 — Markdown Import (workout templates) — LLM spec

Companion: `docs/27--usr--md-import.md`.
Builds on, does not replace: `docs/10-importer.md`.

## Notation decisions locked in this spec

These supersede `docs/4-notation.md` and must land in that file as part of v0 shipping.

1. **`!` is now a mandatory load terminator.** Every load token ends in `!`. It is no longer a "notable / first-time-at-this-load" signal. The terminator removes the ambiguity between load digits and rep digits.
2. **`:` carries both meanings, disambiguated by position relative to `!`:**
   - `:` **before** `!` → pair of implements (e.g. `:20!` = two 20lb dumbbells)
   - `:` **after** `!` (or standalone, no `!` in the token) → per-side reps (e.g. `40!:5-3` = 40lb, 5 reps per side, 3 sets; `:5-3` = 5 reps per side, 3 sets bodyweight)
3. **`;` is not used.** Previous proposal dropped.
4. **"Notable" is removed from the syntax primitives.** If the app ever surfaces "first time at this load," it's a UI-derived affordance computed from history, not a stored or typed token.

### Worked examples under the new rules

| Token | Meaning |
|---|---|
| `40!` | 40lb total, no reps/sets specified |
| `40!:5-3` | 40lb, 5 reps per side, 3 sets |
| `:20!:5-3` | pair of 20lb DBs, 5 reps per side, 3 sets |
| `:20!.10-3` | pair of 20lb DBs, 10 reps, 3 sets (bilateral — no `:` after `!`) |
| `^15!:10-2` | cable stack 15, 10 reps per side, 2 sets |
| `(45)!5-3` | 45lb plate per side, 5 reps, 3 sets (bilateral) |
| `:5-3` | 5 reps per side, 3 sets, bodyweight |
| `30s!-3` | 30 second hold, 3 sets |
| `30s!:-3` | 30 second hold per side, 3 sets |

Parser implication: load token regex is `(:?\d+|\(\d+\)|\^\d+|\d+s)!` — everything up to and including the `!` is load; anything after is reps/sets/side.

## What's already specced vs. what this doc adds

`docs/10-importer.md` is the comprehensive spec (35–45h full version, 8h cut version). Nothing in CHANGELOG indicates it has been built — the only `import` code currently in `app/app.js` is **JSON backup restore** (`stageImport`, `confirmImport`, `applyBackupReplace`, lines ~1872–1930). Markdown import is greenfield.

This doc:
1. Locks the v0 scope to what's needed to ingest the 9.2B sample (and similar legacy files).
2. Identifies concrete grammar deviations in 9.2B and proposes canonical-MD edits that improve parser reliability.
3. Lists the massage recipes specific to the 9.2B file so the same source can be re-imported deterministically.
4. Picks a route, entry point, and Dexie shape that fit the post-r4.10 codebase.

## v0 goal (single sentence)

Paste a legacy workout markdown file → preview parsed tree → "create draft Workout" → records land as Workout > Day > Block > Prescription in Dexie, ready to be opened in the builder and refined.

**Template-only forever.** `.md` import always produces a Workout template skeleton and nothing else. No Sessions, no Performances, no Sets are created from imported files, in v0 or beyond. Per-side `- L … / - R …` sub-bullets parse into `prescription.notes` verbatim. Historical session data in the vault (checkbox state, dated actuals, per-side hold times) is **dropped** by design — sessions get logged live going forward. A session-side importer is "nice to have" only and explicitly **not a planned v1**. Doc 10's session-side parsing is hereby de-scoped from the roadmap; if it ever comes back it'll be its own spec.

## Architecture baseline

- `app/app.js:50–52, 1872–1930` — JSON import pattern (textarea + preview + confirm + flash). Mirror this UX shape for MD.
- `app/db.js` — Dexie. Templates live in `workouts`, `days`, `blocks`, `prescriptions`, `exercises`.
- `app/js/notation.js` — exists per doc 10 §5; reuse for parsing the prescription line.
- Routing: hash-based. Add `#/import-md` (single screen — no stepped UI in v0).

## v0 scope (the 8h cut, slightly reshaped)

| Slice | h |
|---|---|
| 1. `parser.js` line-classifier: `#`, `## N. Name`, `### Subname`, `- [x|·] Name`, indented free text, `Alt:`/`Cue:`/`cues:`, single trailing notation token | 2.5 |
| 2. Hook the existing notation parser for `:N`, `:N-M`, `Ns`, `(N)`, `^N`, `!`, `-N`, `;N`. Anything left → `notes`. | 1 |
| 3. Single-screen UI at `#/import-md` (paste / parse / preview tree / commit) | 2 |
| 4. Dexie commit: insert Workout (draft) → Day → Blocks → Prescriptions in one transaction | 1 |
| 5. Massage recipes for 9.2B applied + documented + smoke-tested end-to-end | 1.5 |

**Total: 8h.** If a slice runs long, cut slice 1's `Alt:`/`Cue:` recognition (drop those lines into `notes` instead) before cutting anything else.

## Input shape v0 supports

Strictly the regular shapes from the legacy vault. Anything else surfaces in the preview as `unparsed: <raw line>` attached to the nearest prescription, parser does **not** guess.

```
# <Workout/Day name>                      → Workout name (1 per file). If absent, prompt.
## N. <Block name>                        → Block, order=N, name
### <Sub-block label>                     → block.subDivider (rendered as label, not its own block)
<free text between block heading and first - bullet>  → block.description
- [x] *Name*    or  - [ ] *Name*          → Prescription (checkbox state ignored in v0)
- [x] **Name**  or  - [ ] **Name**        → same — `*…*` and `**…**` both accepted
- [ ] *Name* - <trailing text>            → trailing text becomes prescription.notes
    <indented free text>                  → appended to prescription.notes (newline preserved)
    Alt: …                                → prescription.alt
    Cue: …  / cue: …  / cues:             → prescription.cues[] (one per line; bullets under `cues:` collected)
    [label](url) inside name or notes     → prescription.refs[] (url + label)
    <trailing single token e.g. 3x30s>    → run through notation parser → load/reps/sets/hold/side
```

Per-side `- L …` / `- R …` sub-bullets: v0 captures them verbatim under `prescription.notes` (one line each). Promotion to `Sets` is deferred to v1.

## Grammar deviations in the 9.2B sample → canonical fixes

The 9.2B file (the message that triggered this spec) exhibits several patterns the parser would refuse, mis-classify, or eat silently. Two paths exist: teach the parser, or normalize the source. Per `docs/10-importer.md` §0, the choice is **massage the source**. The deviations and proposed canonical edits:

| # | What 9.2B does | Why it's brittle | Canonical edit |
|---|---|---|---|
| 1 | Top section `# Shoulder PT` has 4 prescription bullets directly under it, with no `## N.` block heading | Parser expects every prescription to live inside a block. Orphan prescriptions either fail or are silently dropped. | Wrap them in a block: insert `## 0. Shoulder PT` (or `## 1. Shoulder PT` and renumber the rest). The `# …` line stays as the Workout name. |
| 2 | Mixed `**Name**` and `*Name*` | Both readable but doubles the regex surface, and unclosed `**` (e.g. `**[Bear crawl](url)` with no closing `**`) silently consumes following lines. | Settle on `*Name*` for the exercise title. One regex `s/\*\*([^*\n]+)\*\*/\*\1\*/g` plus a manual sweep for unclosed `**`. |
| 3 | `- [ ] **Bear crawl** - cues on same line` (description after ` - ` on the title line) | The trailing ` - ` makes the title regex greedy/ambiguous. | Move the text after ` - ` onto an indented next line. |
| 4 | `:20-2`, `:8`, `:8-2`, `:8-3` used to mean *reps × sets bilateral* | Under the new rules `:` before `!` means "pair of implements" and `:` after `!` means "per-side reps." These bare-`:N` lines have no `!`, so they read as "per-side reps." If the original meaning was bilateral, the source must be edited. | Rewrite to canonical: bilateral `:20-2` → `20-2`; genuinely per-side `:8-2 L first` → `:8-2` (keep the colon) + a `Cue: L first` line. |
| 5 | `.8-2 moderate-heavy` (leading period) | Looks like a typo for `:8-2`. The parser can't disambiguate. | Replace `.8-2` → `8-2`; add `cue: moderate-heavy` if load isn't otherwise specified. |
| 6 | `:8 L+.2` | Unparseable. (`L+.2` is shorthand the parser doesn't know.) | Rewrite to plain English and a normal notation token. E.g. `8 each side` → `;8`. |
| 7 | Free-text block prologue (e.g. *"3 rounds. Same KB, same spot. 90s rest between rounds."*) | Currently no rule for prose between `## N.` and the first `-`. | Already supported in v0 spec above as `block.description`. **No source edit needed**, but be aware some long prose may be ambiguous — leave one blank line between description and the first bullet so the parser can split on it. |
| 8 | Indented sub-checkboxes like `- [ ] **Glute Amnesia Drills**` under Barbell RDL | These are *related drills*, not sub-prescriptions or sets. The parser has no concept for them. | Either: (a) un-indent and add as their own prescription in the same block, or (b) inline into the parent's notes as `also: Glute Amnesia Drills (link)`. Recommend (a). |
| 9 | `- [ ] **Eyes closed balance**` indented under B-stance RDL | Same as #8. | Same fix. |
| 10 | Substitution / "alt:" lines in lowercase plus inline links — `alt: KB halo` then `(when shoulder allows)` parenthetical | Parser regex for `Alt:` is case-sensitive in some grammars. Parenthetical detail is fine. | Normalize all `alt:` → `Alt:`. Keep parentheticals as-is. |
| 11 | Big "Substitution guide for future KB swaps:" prose block between prescriptions | This isn't a prescription, block, or sub-block. Parser will attach it to the previous prescription's notes by default. | Either delete it (it's authoring notes, not workout data) or move it under a final `### Notes` sub-block so the destination is explicit. |
| 12 | Long inline URLs mid-title (`**[Bear crawl](https://…)`) | Already supported as `prescription.refs[]`. **No edit needed** — but unclosed `**` here makes it a vector for #2's bug. | Fix #2 first; the URL handling itself is fine. |
| 13 | First section bullets use ` - <text>` on the title line for the whole prescription notation (`- [ ] **Serratus Wall Slide (band)** - Band at wrists, forearms on wall pointing up, protract shoulder blades, slide arms up. 2x10, 3s hold.`) | The trailing `2x10, 3s hold` is the notation, but it's buried at the end of a prose sentence. Parser will treat the whole sentence as `notes`. | Move notation to its own indented line: `3x30s` (canonical) at end. Move prose to the line above as cue/notes. |

### The massage table (apply in order, top of `docs/import-massage.md`)

```
1. s/\*\*([^*\n]+)\*\*/\*$1\*/g                  # **bold** → *italic* for names
2. Manually close any remaining unclosed **
3. s/^(- \[[ x]\] \*[^*]+\*) - (.+)$/$1\n    $2/ # split same-line title+notes
4. s/^(\s*)alt:/$1Alt:/g                          # lowercase alt → Alt
5. s/^(\s*)cue:/$1Cue:/g
6. Per-line: if a leading `:N` token was meant bilaterally (no per-side intent), drop the colon → `N`.
   If it was genuinely per-side, leave `:N` as-is. Do NOT run globally.
7. s/^\.(\d+)/$1/g                                # .8-2 → 8-2
8. Add mandatory `!` to every load value that lacks one (`40` → `40!`, `:20` → `:20!`, `^15` → `^15!`).
8. Wrap orphan-top bullets in `## 0. <section name>`
9. Un-indent supplementary `- [ ]` drills to be siblings
10. Delete or relocate prose blocks under `### Notes`
```

Storing this as `docs/import-massage.md` is a slice-5 deliverable.

## Parser design (v0)

`app/js/import/parser.js`. No new deps.

1. **Tokenize by line.** Strip trailing whitespace, preserve leading indent count (in spaces or tabs → normalize to spaces, 1 tab = 4 spaces).
2. **Classify each line** by leading marker:
   - `# `      → workoutHeading
   - `## N. `  → blockHeading (extract order, name)
   - `### `    → subBlockLabel
   - `- [x] `, `- [ ] `, `- `, `* ` (zero indent) → prescriptionBullet
   - indented `- L ` / `- R ` → sideBullet (stored as note in v0)
   - indented anything else → noteOrCue (parse for `Alt:`, `Cue:`, `cues:`)
   - blank → separator
   - `[label](url)` only → ref (attach to current prescription)
3. **Build stack.** Workout (1 per file) → Block (current) → Prescription (current). Each classified line either pushes a new node, attaches to the top, or closes the current.
4. **Notation parsing.** When a prescription's title or its first indented line contains a single contiguous notation token (matching `^[\d()^!\-;sx]+$` roughly), call the existing notation parser. Whatever fields it returns populate the prescription; everything else stays as `notes`.
5. **Emit AST** with `sourceRange: { start, end }` (line numbers) per node, for the preview's source-highlighting.

### Tests

- `tests/import/fixtures/9.2B-shoulder-pt.md` — the massaged version of the user's input.
- `tests/import/fixtures/9.2B-shoulder-pt.ast.json` — expected parse output.
- `tests/import/parser.spec.js` — line-classification unit tests + the fixture round-trip.
- One Playwright smoke: paste → parse → commit → assert Workout appears in `#/workouts` with the right block count.

## Single-screen UI (`#/import-md`)

Mirror the existing JSON-restore UX (`app/app.js` lines 1872–1930):

- Textarea + file picker (`accept=".md,.markdown,text/markdown,text/plain"`).
- "Parse" button → renders preview tree below (read-only).
- Preview shows: detected Workout name (editable input), then nested Blocks → Prescriptions. Each prescription shows `name`, parsed `notation` chips, and `notes`. Any `unparsed: …` chunks render as red rows.
- "Create draft Workout" button → commits in one Dexie transaction.
- On success: flash `Imported: N blocks, M exercises` and `gotoHash('#/w/' + id)`.

No draft persistence, no source-line highlighting, no merge-target detection in v0. The single biggest risk to v0 shipping in 8h is letting any of those creep back in. They're all in doc 10 §3–§4 if/when v1 wants them.

## Dexie commit shape

One transaction, all inserts (no upserts in v0 — no merge logic):

```js
db.transaction('rw', [db.workouts, db.days, db.blocks, db.prescriptions], async () => {
  const workoutId = await db.workouts.add({ name, parentId: null, status: 'draft', isCurrent: false });
  const dayId     = await db.days.add({ workoutId, groupKey: 'A', name: '', isAlt: false, order: 0 });
  for (const b of blocks) {
    const blockId = await db.blocks.add({ dayId, name: b.name, order: b.order, description: b.description || '', optional: false });
    for (const p of b.prescriptions) {
      await db.prescriptions.add({ blockId, exerciseId: null, name: p.name, sets: p.sets, reps: p.reps, load: p.load, holdSec: p.holdSec, sideScheme: p.sideScheme, notable: p.notable, cues: p.cues || [], alt: p.alt || '', refs: p.refs || [], notes: p.notes || '', order: p.order });
    }
  }
});
```

Notes on this shape:
- `exerciseId: null` initially — v0 does **not** try to map names to existing `exercises` rows. The builder's existing omnibox will let the user wire each prescription to a canonical Exercise after import. This skips a hairy fuzzy-match decision and avoids creating bogus Exercise duplicates on first import.
- `days` is created with a single Day A. If the file represents multiple days (the 9.2B input does not), that goes to v1.

## How this addresses the postmortem (doc 22) risk

The JSON-restore postmortem found Dexie secondary indexes go stale after `bulkPut` clears+repopulates a table. The MD importer does **`add`** (not `bulkPut`, not `clear`) and only inserts new rows into existing tables, so the index-staleness mode does not apply. No need to mirror the full-scan + filter workaround from `openSession()`.

## Entry point

Add a `↧ import md` button in the same place as the existing JSON `↧ import` button on the workouts list. Cheap, discoverable, doesn't burn a menubar slot.

## Resolved decisions

1. **Notation:** `!` mandatory load terminator; `:` before `!` = pair of implements, `:` after `!` = per-side reps; `;` unused; "notable" removed from syntax (UI-derived only). See top of doc.
2. **Checkbox state ignored on import.** `[x]` in a plan file is aspirational; v0 does not read it.
3. **`Alt:` stays as `prescription.alt` text.** No Variation promotion.
4. **One file = one Day in v0.** Multi-Day support is v1.
5. **Default Day groupKey = `A`** when the file has no Day semantics. User renames after import.
6. **Template-only forever.** No session-side parsing in v0 or planned for v1. Doc 10's session-side scope is de-scoped from the roadmap.

## Deferred to v1

- Merge into an existing Workout vs. always-new.
- Multi-Day files.
- `Alt:` → Variation promotion.
- Exercise auto-mapping (fuzzy or exact) to `exercises` rows.
- IndexedDB draft persistence of paste text.
- Undo within 5 minutes.

## Explicitly de-scoped (not v1, not anywhere on the roadmap)

- Per-side `- L … / - R …` → Sets under an auto-created Session.
- Tracker auto-feed from asymmetry sub-bullets.
- PainMark routing from `$N L|R region` lines.
- Any "log a historical session from a .md file" flow.

Doc 10 retains the full session-side vision for archival purposes; this spec supersedes it for the importer roadmap.
