# User Stories

Format: `As a <role>, I want <action> so that <outcome>.` Acceptance criteria below each. Open questions raised inline.

## Builder

### B1. Start a new training program from scratch
As Charlie, I want to create a new program with named days and skeleton blocks so that I can fill in exercises for a fresh training cycle.

- Given I have no active program, when I tap "+ new program", I see a wizard.
- The wizard asks for program name and first variant name.
- I pick which Days (A, B, C) to include and whether to pre-fill block skeletons.
- On create, I land in the variant view with all the Days listed and their skeleton blocks visible.

Open: should wizard step 2 also let me pre-name a Day "Day A - Front" instead of just "Day A"?

### B2. Fork a variant to a new variant
As Charlie, I want to fork 9.2 into 9.3 so that I can iterate on the design without losing 9.2.

- Given I'm in 9.2, when I tap "fork to 9.3", a new variant 9.3 is created with all blocks/prescriptions copied.
- 9.2 is archived; 9.3 becomes current.
- History links from old sessions still attach to the parent program.

Open: do I auto-bump the minor (9.2 -> 9.3) or prompt for the new name?

### B3. Add a block to a day
As Charlie, I want to add a block to a Day inline so that I don't have to navigate away.

- Given I'm in a Day view, when I tap "+ block", a draft row appears at the bottom with name + type fields.
- I can pick linear or circuit. If circuit, rounds and rest fields appear.
- Save adds the block; cancel discards.

### B4. Add an exercise to a block
As Charlie, I want to type an exercise name into an omnibox and have it autocomplete or create new.

- Given I'm in a block view, when I tap "+ exercise", a draft row appears.
- I type "BSS"; existing exercises autocomplete.
- If I type a new name, a new exercise is created with default category and equipment fields.
- I set sets, reps, side scheme, load. Save commits.

Open: should new-exercise creation also prompt for parent (e.g. "Smith machine BSS" -> parent "BSS")? Currently you'd need to edit the exercise record afterwards.

### B5. Mark notable load
As Charlie, when I'm prescribing a load I haven't used before, I want to mark it notable so the rendered token gets a `!`.

- The edit form has a "notable" checkbox.
- When checked, syntax-mode display shows `50!` and english-mode says "(notable)".

Open: should the app also auto-suggest notable when load > prior max for that exercise+variation? If so, the auto-suggest is a UI prompt the user accepts/rejects, not a silent flag.

### B6. Reorder blocks and exercises
As Charlie, I want to reorder blocks within a Day and exercises within a block so that I can fine-tune flow.

- Up/down arrows on each row. (Drag-and-drop comes in P2/SvelteKit migration.)

### B7. Convert a linear block to a circuit
As Charlie, I want to flip a block between linear and circuit without recreating it so I can experiment.

- A `⇄` button on each block toggles the type.
- Circuit defaults to 3 rounds and 90s rest.

### B8. Create an alt for a Day
As Charlie, when I sometimes train at home with limited equipment, I want a Day A alt so I can prescribe a parallel workout.

- In the variant Days list, "+ day" with "alt" checked creates a sibling under the same group key (A).
- The alt is rendered visually grouped with Day A but distinct.
- Alts do not auto-apply skeletons (since they're typically smaller than the canonical Day).

### B9. Archive a program
As Charlie, when I retire Workout 9 to redesign, I want to archive it so it stays available for reference but doesn't clutter the list.

- Each program row has an archive button.
- Archived programs are hidden by default. A "show archived" checkbox reveals them.
- Archived programs can be restored.

## Sessions (next slice)

### S1. Start a session from a Day
As Charlie, when I'm at the gym, I want to tap a Day and start a session that pre-fills with the prescriptions for editing.

- In a variant Day list, tap "start session". A session is created with auto-date and auto start-time.
- The session view shows the same hierarchy as the Day, with set rows under each exercise.
- Each set is prefilled with last cycle's actuals (if any), shown as ghost values.

Open: do we ask "which Day Variant" if the day has alts, or just open whichever I touched?

### S2. Capture set values
As Charlie, I want to log a set with prefill + chevron increments so most sets are one tap.

- Each set row shows weight and reps cells, prefilled from last cycle.
- Chevrons (`-` `+`) adjust by the active increment (1/5/10).
- "Repeat last" commits an unchanged set.
- Tap the value to type a custom number via OS keyboard.

### S3. Log pain mid-session
As Charlie, when I feel something during an exercise, I want to log a pain mark with severity and side without leaving the row.

- A `$ pain` chip on the active exercise opens a small popover (severity 0-5, L/R, region select).
- Pain marks attach to the performance and surface as pills under the exercise.

### S4. End a session
As Charlie, I want to end the session quickly and confirm my mood and environment.

- Tap "end session" -> auto end-time -> 5-emoji mood scale -> environment chip (gym/home/park) -> "save".
- Session is committed.

### S5. Three-level notes
As Charlie, I want to capture observations during a session at the right level of granularity.

- Top of session: "running log" - timestamped notes I append throughout.
- Per-exercise: a free-text note on the prescription performance.
- Per-day: a single freeform note for the whole session.

Open: where should the running log live visually? A pinned strip at top, or a drawer accessible by long-press?

### S6. Quick history glance
As Charlie, while logging a set, I want to see what I did last cycle on this same exercise.

- Each exercise row shows a ghost row with last cycle's actuals.
- Tapping the ghost opens the per-exercise history view.

## History

### H1. Browse all past sessions
As Charlie, I want a chronological list of every session, filterable.

- Filters: program, variant, day, env, date range, pain only.
- Tap a row to see day detail.

### H2. Per-exercise progression
As Charlie, I want to see how a specific exercise has progressed over time.

- Pivot on the parent exercise. All variations roll up.
- Chart of working-set load with high/low values labeled on bars.
- Variations toggle to include/exclude children from the chart.

### H3. Compare two exercises
As Charlie, I want to overlay another similar exercise on the chart so I can compare progressions.

- "Compare with..." button on the per-exercise view.
- Picks any other exercise; overlays its chart.

### H4. Delete a session
As Charlie, sometimes I open a session by mistake or it doesn't deserve to be saved. I want to delete it cleanly.

- Day detail view has a "delete session" button.
- Deleted sessions go to a 30-day trash before purge.

## Trackers (P2)

### T1. Track an active injury
As Charlie, when I have an injury (L hip strain), I want a tracker entity that aggregates pain marks across exercises so I can see how it trends.

- New tracker: kind = injury, side = L, region = hip.
- Link the tracker to BSS, RDL, and any other exercise that aggravates it.
- Pain marks logged on linked exercises auto-roll up to the tracker timeline.

### T2. Track an asymmetry
As Charlie, I want to log L vs R values for single-leg balance so I can see the gap close.

- Tracker kind = asymmetry. Each session captures `{left: N, right: N}`.
- Timeline plots both values; gap is computed and trend-lined.

### T3. Track a skill
As Charlie, I want to log discrete or graded skill progress (handstand wall hold time, capoeira au form 1-5) without forcing it into "exercise" semantics.

- Tracker kind = skill. One-value entries per session. Optional 1-5 quality scale.

## Sync

### SY1. Same data on phone and laptop
As Charlie, when I design a workout on my laptop and walk into the gym, I want my phone to have the latest template.

- Sign in via magic link on both devices.
- Edits on either device sync within seconds when both are online.
- Offline edits queue and drain on reconnect.

Open: does the phone need to fully pull the entire history, or only recent sessions plus all templates? (Templates are tiny; sessions can grow.)

### SY2. Survive a phone wipe
As Charlie, if I lose my phone and reinstall, I want my data to come back from the cloud.

- New device pulls all records on first sign-in.
- Local cache rebuilds from cloud.

## Import / export

### I1. Export everything as a backup
As Charlie, I want a one-tap "download backup" that gives me a JSON I can keep elsewhere.

- Settings -> export -> download zip.
- JSON full backup, plus markdown per session, optional CSV.

### I2. Stepped import of legacy notes
As Charlie, I have years of Workout PRX markdown that I want to bring in eventually. I want to import in chunks, with a parse preview, line-by-line review, and the ability to save a draft and resume.

- Defer to P3.
