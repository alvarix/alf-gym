# Import Massage Recipes

Apply these edits to a raw legacy vault `.md` file **in order** before importing via `#/import-md`.
The goal is to produce a file the parser will classify cleanly, with no silent data loss.

Each recipe is marked as either `global` (safe to run as a regex over the whole file) or `manual` (requires per-line judgment).

---

## Recipes

### 1. Normalize bold → italic for exercise names (`global`)
```
s/\*\*([^*\n]+)\*\*/\*$1\*/g
```
Converts `**Bench Press**` → `*Bench Press*`. Reduces regex surface area and avoids unclosed-bold bugs.

### 2. Close any remaining unclosed `**` (`manual`)
Search for lone `**` with no matching close on the same line and close or convert to `*`.
Example: `**[Bear crawl](url)` → `*[Bear crawl](url)*`

### 3. Split same-line title + notes (`global`)
```
s/^(- \[[ x]\] \*[^*]+\*) - (.+)$/$1\n    $2/
```
Moves description text that trails after ` - ` on the bullet line to an indented next line,
so the parser classifies it as `notes` rather than treating it as part of the exercise name.

### 4. Normalize `alt:` → `Alt:` (`global`)
```
s/^(\s*)alt:/$1Alt:/g
```

### 5. Normalize `cue:` / `cues:` → `Cue:` (`global`)
```
s/^(\s*)cues?:/$1Cue:/g
```

### 6. Fix leading-dot typos in notation tokens (`global`)
```
s/^\./\./g
```
Example: `.8-2` → `8-2`. A leading `.` in a token is always a typo for a digit or `:`.

### 7. Add mandatory `!` to load values that lack it (`manual`)
Every load token must end in `!`. Scan each notation token and append `!` to the load portion.
- `40` → `40!`
- `:20` → `:20!`
- `^15` → `^15!`
- `(45)` → `(45)!`

Do **not** run globally — the `!` position determines meaning for `:` disambiguation.

### 8. Fix `:N` bilateral vs per-side (`manual`)
Under the locked notation, `:` before `!` = pair of implements, `:` after `!` = per-side reps.
A bare `:N` token (no `!`) is interpreted as per-side reps (bodyweight).

For each `:N` or `:N-M` token in the source, decide:
- Was it meant as bilateral? → Drop the `:` → `N` or `N-M`
- Was it genuinely per-side (unilateral)? → Keep `:N` as-is (it becomes per-side bodyweight)

### 9. Wrap orphan top-level bullets in a block heading (`manual`)
If the file has prescription bullets directly under the `#` heading with no `## N.` block:
```
## 0. <section name>
```
Insert this before the first orphan bullet. The `# …` line stays as the Workout name.

### 10. Un-indent supplementary drills (`manual`)
Sub-checkboxes like `    - [ ] **Glute Amnesia Drills**` indented under a parent prescription
should be un-indented to be siblings in the same block (own prescription at indent 0),
or converted to `    also: Glute Amnesia Drills` notes on the parent.

### 11. Relocate or delete prose blocks (`manual`)
Large prose sections (e.g. "Substitution guide for future KB swaps:") that appear between
prescriptions are not exercises and will be attached to the nearest prescription as notes.
Either delete them or move them under a `### Notes` sub-heading at the end of the block.

---

## Order matters

Run recipes 1–7 first (most are global regexes). Then make manual edits for 8–11.
After all edits, paste the result into `#/import-md`, click **parse**, review the preview tree
for any `_unparsed` rows (shown as plain text in the preview), and fix before committing.

---

## Quick checklist

- [ ] Bold → italic normalized (recipe 1)
- [ ] Unclosed `**` closed (recipe 2)
- [ ] Same-line title+notes split (recipe 3)
- [ ] `alt:` / `cue:` casing normalized (recipes 4–5)
- [ ] Leading `.` in tokens fixed (recipe 6)
- [ ] All load tokens have `!` (recipe 7)
- [ ] `:N` bilateral vs per-side decided (recipe 8)
- [ ] Orphan top-level bullets wrapped in `## N.` (recipe 9)
- [ ] Supplementary drills un-indented or inlined (recipe 10)
- [ ] Prose blocks relocated or deleted (recipe 11)
