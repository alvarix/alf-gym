# Markdown Importer Spec

## 0. 8-hour cut (recommended starting scope)

The full spec below estimates 35–45h. To land something useful in **~8h**, ship a stripped-down v0 and rely on pre-massaging the source files instead of teaching the parser every legacy shorthand. The grown-up version stays as a target; v0 is a sharp tool for one job.

### What to keep
- Single-screen paste + parse + commit. No stepped UI, no draft persistence, no source-range highlighting.
- Parser handles only the regular shapes: `## N. Name` -> Block, `- [x|·] *Name*` -> Prescription, indented free text -> prescription notes, single trailing notation token (e.g. `3x30s`, `40!`).
- Always creates a **new draft Workout**. No merge-target detection. User renames or forks afterward via existing builder.
- Per-side `- L 1:30 / - R 2:00` sub-bullets parse into Sets (side + holdSec). That's the one session-side feature that earns its keep.

### What to cut
- The 4-step UI (paste / preview / review / commit) collapses to one screen. Saves ~12–18h.
- Session vs. template split logic. v0 imports the template skeleton; if the file has actuals, they ride along on a single auto-created Session. No reconciliation against existing Workouts. Saves ~4–6h.
- Tracker auto-feed, asymmetry detection, pain mark routing. Drop entirely. PainMarks parse as plain notes for now. Saves ~2–3h.
- Undo / 5-minute reversal. Use Reset DB if you mess up; commits are cheap. Saves ~1–2h.
- Alt -> Variation promotion. `Alt: ...` lines land as plain text on `prescription.alt`. Saves ~1–2h.
- Round-trip and fixture-driven test suite. One Playwright smoke test plus the Day C fixture is enough for v0. Saves ~3h.
- IndexedDB draft persistence. Keep paste in component state. If you nav away, you re-paste. Saves ~1h.

### Massage the data, not the parser
Most parser complexity in the full spec exists to handle legacy shorthand (`:N`, `:-3`, Roman numerals, `L-2 R-3`, `m:ss` time, mixed bullet styles). Before importing, run the source files through a documented find/replace pass:

| Source pattern | Replace with | Done by |
|---|---|---|
| `:N` per-side reps | `;N` | one regex |
| `-III` / `-IV` | `-3` / `-4` | manual, rare |
| `m:ss` hold time | `Xs` (seconds) | manual, you know which lines |
| `L-2 R-3` shorthand | two sub-bullets `- L 2 sets` / `- R 3 sets` | manual |
| Mixed `*name*` vs `**name**` | settle on `*name*` | one regex |
| Stray top notes / cue lines you don't care about | delete | manual |

Document the recipes in `docs/import-massage.md` (or a fenced code block in this file) so future-you can run them again. The first 3–5 real files are the only ones that matter; later files can be authored in the canonical grammar from the start.

### 8h budget
| Slice | h |
|---|---|
| Minimal line-classifier parser (headings, prescription bullets, indented notes, L/R sub-bullets) | 2 |
| Hook to existing notation parser for the prescription line; ignore anything it can't parse | 1 |
| Single-view paste + parse + "create Workout" Dexie commit | 2 |
| Per-side sub-bullets -> Sets under an auto-created Session | 1 |
| Massage recipes documented + applied to Day C fixture | 1 |
| Smoke test on Day C, fix obvious bugs | 1 |

**Total: 8h.** No buffer. If a slice runs long, cut the L/R sub-bullets first (everything still works as a template-only import) and revisit them in v1.

### When to graduate to the full spec
Once you've imported 5+ real files via v0 and know which shortcomings actually bite. The full spec's stepped UI and review step exist precisely to handle "this file is weird and I want to fix it inline" — but you may find the massage workflow stays good enough indefinitely.

---

Stepped, resumable importer for legacy Workout vault markdown. Phase P3. Reads a single file (or paste), produces a parse tree, lets you review and correct it, and commits to the structured store.

The format is the one already in use across years of notes: headings as blocks, italics as exercise names, bullets as prescriptions, checkboxes as completion, sub-bullets as per-side or per-set actuals, inline notation per `docs/notation.md`. See section 9 for a representative input.

## 1. Goals

- Bring legacy markdown into the structured store without manual re-entry.
- One file may contain both **template** (prescription) and **session** (actuals) data; importer must split them.
- Resumable: paste, save draft, leave, come back. No partial commits.
- Idempotent: re-importing the same source does not duplicate.
- Lossless within the supported grammar; anything ambiguous surfaces for review, not silent guesses.
- Round-trippable with the export format. Importing an exported file reproduces the same records.

Non-goals:
- Auto-fixing arbitrary user shorthand. We support the documented grammar plus a small set of legacy normalizations; everything else goes to the review step.
- Bulk vault crawl in v1. One file at a time. Multi-file batch is a follow-up once the parser is trusted.

## 2. Input shape

Per the legacy vault. Heading levels carry semantic meaning:

```
# Day C - Diagnostics + Skills          -> Day (name = "Day C", group = "C", optional sub-title)
## 1. Diagnostic ISOs                    -> Block 1 (name = "Diagnostic ISOs")
- [x] *Single-leg wall sit*              -> Prescription (exercise name italicized; checkbox = completed)
    Max hold each side, log time...      -> Prescription notes / cue
    Alt: single-leg squat hold...        -> Alternate variation hint
    - L 1:30                             -> per-side actual (Set: side L, holdSec 90)
    - R 2:00                             -> per-side actual (Set: side R, holdSec 120)
```

Other patterns the parser must recognize:

| Pattern | Maps to |
|---|---|
| `## N. Name` | Block, order N, name |
| `### Subname` | Sub-block label (rendered as a divider inside the parent block; not its own Block entity) |
| `- [x] *Name*` / `- [ ] *Name*` | Prescription with `completed: true|false` (session-level signal) |
| `*Name*` (no checkbox) | Prescription without session signal |
| Indented free text after a prescription | `prescription.notes` (joined, newline preserved) |
| `Alt: X` / `Alt. X` line | `prescription.alt` text; optional promotion to Variation in review step |
| `Cue: X` / `--> X` | `prescription.cues[]` |
| `- L 1:30` / `- R 2:00` | Per-side Set under the prescription. Time `m:ss` -> `holdSec` |
| `- L-2 R-3` | Two sets, with per-side counts; legacy shorthand |
| `:-3` / `-3` / `-III` alone | Set count, no other change |
| `40!` | Load 40, notable |
| `3x30s` | 3 sets of 30s holds |
| `[label](url)` inside an exercise name or note | `prescription.refs[]` (kept for display; not a domain entity) |
| `+ activity` line outside a block | Aux activity, attached to the parent Day session |
| Top-of-file metadata block (key: value lines) | Session header: date, env, mood, notes |

The parser emits everything else as `unparsed` chunks attached to the nearest prescription, surfaced in step 3 for hand-edit.

## 3. Splitting template from session

The fundamental call: one markdown file usually represents *one session*, but it implicitly carries *the template that session ran against*.

Rules:

1. The skeleton (headings, exercise names, prescription text without per-side actuals) becomes a **Workout / Day / Block / Prescription** tree.
2. Per-side sub-bullets, checkbox state, and any explicit numeric values inside a prescription line that aren't the prescription itself become a **Session / Performance / Set** chain.
3. If the file's heading or metadata names a known Workout (e.g. `Day C - Diagnostics + Skills` matches an existing Workout's Day C), the importer **merges** into the existing template rather than creating a new one. Match priority: explicit `workout: <name>` metadata, then heading text, then content fingerprint (set of exercise names).
4. If no match, the importer creates a new Workout in `draft` status. User can promote it to `current` after review.
5. Sessions always create new records (sessions are append-only by design).

The user picks the merge target in step 2 (preview) — defaults computed, override available.

## 4. Stepped UI

Four views, each its own URL so the import is bookmarkable mid-flight.

### 4.1 Step 1 — Paste / upload (`#/import/paste`)

Single textarea + file picker. "Parse" button. No commits yet. Draft persisted to IndexedDB on every keystroke (debounced 500ms) under `imports/{draftId}`.

### 4.2 Step 2 — Preview (`#/import/{draftId}/preview`)

Read-only tree view of the parsed AST.

- Left column: source markdown with line numbers.
- Right column: parsed structure (Workout > Day > Block > Prescription > Set).
- Each parsed node shows source range; clicking either side highlights both.
- Header: detected merge target (Workout + Day) with override picker. "No match — create new" is the default-default.
- Banner totals: `N blocks, N exercises, N sets, K unparsed chunks`.

If unparsed chunks > 0, "Continue" is allowed but warns.

### 4.3 Step 3 — Review (`#/import/{draftId}/review`)

Line-by-line editor. Each prescription is a row with the same inline form used in the builder, pre-populated from the parse. Unparsed chunks render as red rows that must be either resolved (assigned to a field) or explicitly dismissed.

Per-row actions:
- Edit fields (sets, reps, load, side scheme, notable, hold, cues, alt).
- Promote alt to a Variation under the parent Exercise.
- Detach this prescription from the import (skip it on commit).
- Map exercise to existing canonical Exercise (omnibox, same pattern as the builder).

Per-set actions on the session side:
- Edit reps / load / side / hold.
- Drop the set.

A "diff" toggle shows what will be created vs. merged into existing records.

### 4.4 Step 4 — Commit (`#/import/{draftId}/commit`)

Final summary. "Commit" runs in a single Dexie transaction:

1. Upsert Workout / Day / Block / Prescription (template side).
2. Insert Session / Performance / Set (session side).
3. Insert any new Exercise records detected.
4. Mark draft as `committed` with the new record ids; don't delete (kept for audit / undo).

A single "Undo" button on the success screen reverses the transaction within 5 minutes. After that it's a manual delete.

## 5. Parser

Plain JS module under `app/js/import/parser.js`. No new deps. Strategy:

1. Tokenize by line. Classify each line by leading marker (`#`, `##`, `-`, indented, blank, link-only, key:value, etc.).
2. Build a heading stack. Each line either pushes, pops, or attaches to the top of the stack.
3. Within a prescription, run the existing notation parser (`app/js/notation.js`) on the title + first line. Anything left becomes `notes`.
4. Per-side sub-bullets parse via a small dedicated rule: `^- ?([LR])\s+(.+)$` then run the value through the time/rep/load mini-grammar.
5. Emit an AST with explicit source ranges on every node so the preview can highlight.

Tests live in `tests/import/`. Each fixture is an input `.md` plus expected `.json` AST. Round-trip tests run import -> export -> import and assert equality.

## 6. Notation extensions for legacy patterns

The legacy vault uses a few shorthands not in `docs/notation.md`. The importer normalizes them; the canonical grammar is unchanged.

| Legacy | Canonical | Notes |
|---|---|---|
| `:N` for per-side | `;N` | Already specified in 6.2; importer normalizes on save |
| `-III`, `-IV` Roman | `-3`, `-4` | Numeric on save |
| `m:ss` time | `holdSec` integer | `1:30` -> 90 |
| `LN` / `RN` inline | side + value | e.g. `L-2 R-3` |
| `:-3` (no value before) | `-3` | Stray colon swallowed |
| `:N` after a hold value | `;N` per-side | Context-disambiguated |

Anything else surfaces as `unparsed` for review.

## 7. Trackers and pain marks

- `$N L|R region` lines parse to PainMark and attach to the nearest performance (or to the Day session if outside any prescription).
- Asymmetry-style sub-bullets (`- L 1:30 / - R 2:00`) on prescriptions linked to an Asymmetry tracker auto-feed the tracker timeline. Linkage is detected by exercise id; if no tracker exists yet, a "create asymmetry tracker?" suggestion appears in step 3.
- Skill rows (e.g. capoeira items in the sample) without numeric values still create a Performance with `completed` flag for the session record.

## 8. Edge cases

- **Partial completion** (some `[x]`, some `[ ]`): the unchecked prescriptions get a Performance with no Sets. They show as "skipped" in the session view; the prescription itself still imports cleanly.
- **No date in file**: prompt in step 1 with today's date as default.
- **Multiple Days in one file**: split at top-level `#` boundaries; each becomes its own session under one Workout commit.
- **Re-import of an already-imported file**: detected by content hash on the draft; warn and offer "merge corrections" (re-runs upserts and adds any new sets) vs "discard import".
- **Cross-day links** (`+ activity` outside a block): attached to the Day session as an `EnvMark` or aux note depending on content.
- **Free-text Day intro** (e.g. `~60 min. Gym, park, or home. Optional but recommended.`): captured as `day.description` on the template side and `session.dayNote` on the session side.

## 9. Sample input fixture

Stored at `tests/import/fixtures/day-c-diagnostics.md`. The pasted Day C sample (Diagnostic ISOs, Weighted stretching, Plyos, Skills, Cooldown) is the canonical first fixture. Expected AST captures: 1 Workout merge target (existing Workout 9.x Day C), 5 blocks, ~25 prescriptions, ~10 sets across the completed ISO entries, 0 pain marks, several `Alt:` lines promoted to Variation candidates, several `[label](url)` refs preserved.

## 10. Out of scope (v1)

- Bulk import of an entire vault folder. (Add once the parser has eaten 10+ real files cleanly.)
- OCR / handwriting / image import.
- Auto-creating Trackers without confirmation.
- Inferring program lineage across imported files (heuristics for "9.2 -> 9.3"). Manual fork stays the path.

## 11. Tests

- Unit: parser line classification, notation normalization (`:` -> `;`, Roman -> arabic, `m:ss` -> seconds), AST shape per fixture.
- Integration: end-to-end import of fixture file -> records in IndexedDB -> exported back -> identical AST.
- E2E (Playwright): paste -> preview -> review (resolve one unparsed chunk) -> commit -> assert session row visible in `/sessions`.

## 12. Open questions

1. Do we want a "library" of saved imports (keep all source markdown forever for re-import) or purge after commit + 30 days?
2. For exercise auto-mapping, do we use exact-match only (safer) or fuzzy with confirm (faster)? Default exact in step 2, fuzzy as an opt-in in step 3.
3. Should "skipped" prescriptions count toward session completion %? Currently no — completion is sets-with-values / total-sets.
4. Where does the "import" entry point live? Settings page, or a new top-level menubar chip? Lean settings until P3 ships, then re-evaluate.
