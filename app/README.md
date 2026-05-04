# alf-gym/app

Wired Template Builder prototype. Alpine.js + Dexie + IndexedDB. Single-file, no build step.

## Run

Open `index.html` directly. No server required for first use.

If running a local server (e.g. `python3 -m http.server`), styles work because `app/` is now self-contained at `app/assets/styles.css`.

## What it does

- Hash-routed URLs (back/forward, bookmark any view).
- New-program wizard: name -> Day picker (with skeletons) -> create.
- CRUD on Programs, Variants, Days (with alt grouping), Blocks (linear or circuit), Exercises (the data field is `prescriptions`, but the UI says "exercise").
- Day skeletons for A/B/C use movement-pattern blocks (Squat, Push, Pull, Hinge...).
- Persisted to IndexedDB (Dexie). Idempotent seed: re-loads do not duplicate data.
- App-wide `en | syn` toggle in the header.
- Exercise picker is an omnibox (type to search, type a new name to create).

## What it does not do (yet)

- Drag-to-reorder (use `↑` `↓`).
- Sessions, history, sync, export, importer.
- Per-exercise alt list, cues, branching variation.
- Trackers UI (data layer present, views ship in P2 mockup).

## Reset

Click `json` in the menu, then `reset DB`. Or open dev tools -> Application -> IndexedDB -> delete `alfgym` -> refresh.

## File structure

```
index.html          Alpine shell + view templates
db.js               Dexie schema + seed
app.js              Alpine component
```
