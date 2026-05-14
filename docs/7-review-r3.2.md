# Round 3.2 Review: Design + Use Process Walkthroughs

After applying the r3.2 fixes (inline edit, hide archived, next-step strip), walk through the app twice from each angle. Findings feed the next iteration.

## Design process, pass 1

A designer cold-opens the app at `index.html`, no instructions.

What they see:
- Top: title, breadcrumbs, syntax toggle, json button.
- Left of headline: "Programs" h2.
- Right of headline: "+ new program" CTA in accent color.
- Body: cards for "Workout 9" and any others. Each shows status and an "open" button.
- Bottom: a wizard text describing what to do.

Findings:
1. Visual hierarchy is fine but flat. The "+ new program" and the program rows compete for attention without strong distinction.
2. The breadcrumb uses `>` separators but the "Programs" link looks like body text. Could underline on hover or color it accent.
3. The next-step strip (added in r3.2) sits above the heading. That's fine, but it should not appear on the Programs view when there's just one program because the "next step" is implicitly to tap that program.
4. The wizard text at the bottom is helpful but visually heavy. A 3-line tip with an "expand for details" might be lighter.
5. The "json" button is a developer affordance; users won't know what it is. Should it be hidden behind a settings menu?

## Design process, pass 2 (after pass 1)

Same designer revisits with pass-1 issues in mind.

What changes if we fix pass 1:
- Less wizard-text noise on Programs view (collapse by default after first visit).
- Hide JSON button under a settings menu.
- Stronger visual weight for "+ new program" (bigger, fuller bg).

New findings:
6. The Day-list grouping ("Day A" header above multiple Day-A cards) is good, but if no alt exists, the group header is redundant noise.
7. In the Block view, exercises are rendered as cards but the inline-edit form replaces the card content and reuses the same card. Without a visual delimiter (border-color change, indent) the user might not realize they're editing in place. The `editing` class adds a border-color, but it's subtle.
8. The omnibox is a `<datalist>`-driven input. On desktop Chrome, the dropdown appears on focus only after typing. iOS Safari's datalist UX is different (it shows full list immediately). Worth testing on real devices.
9. The flash toast appears at bottom-center with a black background. On a long page the user has scrolled past, the toast may be off-screen. Use a top-fixed alternative or a transient inline banner near the action.
10. There is no global FAB (designed but not placed in r3.2). The mockup-v2 had one. Add it for consistency before sessions ship.

## Use process, pass 1

A new user (not me) opens the app, sees Workout 9 and the next-step strip ("Tap a program to open its current variant").

Their first action: tap "Workout 9". Lands on `9.2`. The breadcrumb shows `Programs › Workout 9 / 9.2`. They see Day A, Day A alt, Day B, Day C. Day A says "6 blocks · Warmup · Anchor · Anti-Rotation · KB compound". Day A alt says "empty · tap to design".

They tap Day A alt. They see no blocks. Empty state appears: "No blocks yet. A block is a grouped section like Warmup, Squat, or Pull. + first block".

They tap "+ first block". Inline draft appears at the bottom (or wherever button was). They type "Squat" and pick "linear", tap "add block". Block appears.

They tap the new Squat block. Empty state: "No exercises yet. Add the first one. + exercise".

They tap "+ exercise". Inline draft appears. They type "Smith machine BSS" - the omnibox autocompletes. They set sets=3, reps="8,10,12", side="unilateral L-first", load="50,55,60", check notable, tap "add exercise". The exercise appears as `2.1 Smith machine BSS`, formatted.

They check the syntax toggle at top. Now `2.1` shows as `50!,55,60;8,;10,;12-3` or similar. They click back to en mode.

Findings:
1. The draft form appears at the bottom of the list, but if there are many exercises, the form is below the fold. User has to scroll to see it. Either auto-scroll on open or position the draft at the top.
2. The "load (lb)" hint says `50 · 50,55,60 · ^15 · (35) · band`. Helpful. But "(35)" is plate-per-side notation; users not familiar with this won't get the meaning. Maybe link to docs/notation.md or expand inline help.
3. Autocomplete via datalist works, but there's no visual cue that you can type a NEW name; users may expect a "+ create" button.
4. "Notable" checkbox is fine, but the explanation is "first time at this load (renders !)". A user might not know what `!` means contextually. Show a tiny preview next to the checkbox: "renders as `50!`".
5. After saving an exercise, focus is lost; if you want to add another, you have to tap "+ exercise" again. Better: "save and add another" button.
6. Syntax toggle showed reasonable output, but a per-block label or example would help users connect the dots.

## Use process, pass 2 (after pass 1)

User comes back the next day to add Day B exercises.

They navigate via URL (which now works thanks to hash routing). They paste `#/v/1/d/4` and land in Day B. Breadcrumbs work.

They tap Squat block. Empty. "+ exercise". They want to add multiple exercises in a row. Issue: as noted in pass 1, no "save and add another".

They want to copy an exercise from Day A's Squat block to Day B's Squat block. There's no copy/duplicate affordance. They have to type the name and re-enter all fields.

They want to add a SUPERSET (linked exercises within a block). The data model supports circuits but not "this exercise is supersetted with that one". Real-world: "DB chest fly + Bulgarian SS, 3 rounds together" while keeping each as its own row. The current UI treats either: a circuit block with N exercises, OR linear with separate rows. No "pair these two" affordance.

They notice: every Day starts at "Day A" / "Day B" / "Day C" but they want a fourth, "Day D" or "Day A2". The wizard was hardcoded to A/B/C. The "+ day" form does support custom group keys though.

Findings:
7. Copy/duplicate exercise affordance missing. Common when designing parallel days.
8. No superset / pair concept inside a linear block. Real workouts have these (e.g. compound + accessory).
9. Wizard is A/B/C only. Allow custom day keys in the wizard.
10. URL is bookmarkable but no visible "share this" affordance. Future polish.
11. Day reorder via ↑↓ is fine, but reordering Day A under group A puts it next to Day A alt: order matters within a group, not across the whole list. Currently `moveDay` walks the global order, which could mix groups. Need to test or scope to within-group.

## Findings consolidated -> backlog

Priority for next round (P1.5 polish or migrate-to-Svelte time):

| # | Finding | Severity |
|---|---|---|
| 1 | Empty Programs view: hide next-step strip when only obvious | low |
| 2 | Wizard text collapsible after first visit | low |
| 3 | Hide JSON button under a settings menu | medium |
| 4 | Add global FAB for consistency | medium |
| 5 | Day group header redundant if no alt | low |
| 6 | Strengthen visual delimiter on inline edit | medium |
| 7 | Test omnibox on iOS Safari (datalist quirks) | medium |
| 8 | Flash toast position when scrolled | low |
| 9 | Auto-scroll to draft on open, or position at top | medium |
| 10 | Inline help for `(35)` and `^15` notation | low |
| 11 | "Save and add another" button on exercise add | high |
| 12 | Copy/duplicate exercise affordance | high |
| 13 | Superset / paired exercises within a linear block | high (data model) |
| 14 | Wizard supports custom Day keys | medium |
| 15 | Verify moveDay scopes correctly within group | high (potential bug) |
| 16 | Visible "create new exercise" cue in omnibox | medium |
| 17 | Notable: show inline preview "renders as 50!" | low |
| 18 | Better notation hint or link from load field | low |

Items 11, 12, 13, 15 are blockers for designing real workouts efficiently. Worth addressing before sessions ship. Item 13 (supersets) implies a data-model change (`Prescription.pairId` or `Block.subgroups`).
