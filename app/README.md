# alf-gym/app

Wired Template Builder prototype. Alpine.js + Dexie + IndexedDB. Single-file, no build step.

## Run

Open `index.html` directly. No server required for first use.

If running a local server (e.g. `python3 -m http.server`), styles work because `app/` is now self-contained at `app/assets/styles.css`.

## What it does

- Hash-routed URLs (back/forward, bookmark any view).
- New-program wizard: name -> Day picker (with skeletons) -> create.
- CRUD on Workouts (no Program/Variant), Days (with alt grouping), Blocks (linear or circuit), Exercises (the data field is `prescriptions`, but the UI says "exercise").
- Fork a workout to a new revision: copies days, blocks, prescriptions; links via `parentId`.
- Day skeletons for A/B/C use movement-pattern blocks (Squat, Push, Pull, Hinge...).
- Persisted to IndexedDB (Dexie). Idempotent seed: re-loads do not duplicate data.
- App-wide `en | syn` toggle in the header.
- Exercise picker is an omnibox (type to search, type a new name to create).
- In-session **add / remove exercise** with three-way scope: *session only* (snapshot, prescription not touched), *to template* (also writes the underlying prescription), or *fork* (deep-copies the workout first, then writes to the fork and re-points the session).

## What it does not do (yet)

- Drag-to-reorder (use `↑` `↓`).
- Sync. Markdown importer.
- Per-exercise alt list, cues, branching variation.
- Trackers UI (data layer present, views ship in P2 mockup).

## Reset

Click `json` in the menu, then `reset DB`. Or open dev tools -> Application -> IndexedDB -> delete `alfgym` -> refresh.

## Backup & restore

Stopgap for moving data between devices until Supabase sync lands. Replace-all only — export on device A, import on device B.

### From the app

1. Click `backup` in the menubar.
2. **Export**: `download .json` or `copy to clipboard`.
3. **Restore**: pick a `.json` file or paste JSON into the textarea, click `preview`, then `replace all`.
4. After a restore, an `undo last restore` button stays visible for one rollback (stashed in `localStorage`).

Schema-version mismatches are refused; cross-version migration is not supported.

### Manual snapshot via DevTools

If the app is misbehaving or you want a raw snapshot outside the UI, open DevTools while the app is loaded and run in the console:

```js
const tables = ['workouts','days','blocks','exercises','prescriptions','sessions','performances','sets','painMarks','trackers','wishlist','meta'];
const dump = {};
for (const t of tables) dump[t] = await window.alfdb[t].toArray();
copy(JSON.stringify({
  app: 'alf-gym',
  schemaVersion: 5,
  exportedAt: new Date().toISOString(),
  stores: dump,
  settings: { syntax: localStorage.getItem('alfgym.syntax') === '1' }
}, null, 2));
```

The clipboard now holds a backup compatible with the in-app **Restore** flow. Paste it into a file named `alfgym-backup-YYYY-MM-DD.json` and keep it somewhere safe.

## File structure

```
index.html          Alpine shell + view templates
db.js               Dexie schema + seed
app.js              Alpine component
```
