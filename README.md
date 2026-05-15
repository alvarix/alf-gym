# alf-gym

A mobile-first PWA for tracking gym sessions. Offline-first, fast capture, history that surfaces last cycle's output as you log this cycle's.

## Import
To import your session data locally:
1. Navigate to `http://localhost:8000`
2. Open the backup panel (look for a backup/restore section — probably in settings or a gear icon)
3. Use **"pick a file"** and select `/Users/alvarsirlin/Sites/apps/alf-gym/data/alfgym-backup-2026-05-14T18-30-13.json

## Status

r4.8 — session capture UI overhaul: prefill from last session as input placeholders (prescribed as fallback), exercise cues drawer, day name shown on session list and header, load/reps column order swapped, side column removed, set rows locked until `edit` on completed sessions. See CHANGELOG.

## Repo layout

```
SPEC.md                   living planning document
CHANGELOG.md              dated entries per revision
README.md                 you are here
docs/
  architecture.md         tech choices and tradeoffs
  decisions.md            ADR-lite log
  notation.md             canonical syntax reference
  migration-sveltekit.md  target stack and migration steps
  user-stories.md         builder + sessions + history stories
  review-r3.2.md          design review findings and backlog
  handoff.md              state snapshot for the next model
tests/
  README.md               planned test approach (Vitest + Playwright)
app/                      wired prototype (Alpine + Dexie, no build step)
```

Mockup rounds (v1, v2) are excluded from the repo. See CHANGELOG for what each round covered.

## Run

No build step. Static files only.

```
cd app && python3 -m http.server 8000
# open http://localhost:8000
```

Or open `app/index.html` directly in a browser.

## Deploy

Vercel config is in `vercel.json` at repo root (`outputDirectory: app`). Connect the repo in the Vercel dashboard — no build command required.

Live deploy: https://alf-gym.vercel.app *(connect repo to activate)*

## Export your data

alf-gym has no server. Vercel hosts the static shell only; everything you log lives in IndexedDB on the browser/device where you logged it (database name `alfgym`). To get your data off a device, export from that same browser.

### What's in an export

A single `.json` file containing all 12 stores at the current schema version (`schemaVersion: 5`):

| Store | What it holds |
|---|---|
| `workouts`, `days`, `blocks`, `prescriptions`, `exercises` | The template you logged against |
| `sessions` | One row per session run (start/end timestamps, mood, env) |
| `performances` | Per-prescription snapshots inside a session |
| `sets` | Every logged set (the actuals) |
| `painMarks` | Pain logs tagged to a session/performance |
| `trackers`, `wishlist`, `meta` | Side tables |

The shape is a flat, round-trippable dump — the same file restores via the **Restore** flow.

### Option 1 — In-app (recommended)

1. Open the deployment in the **same browser profile** that holds the data: https://alf-gym.vercel.app
2. In the top-right menubar click **`backup`**.
3. Under **Export** choose one of:
   - **`download .json`** — saves `alfgym-backup-YYYY-MM-DD.json` via the browser download.
   - **`copy to clipboard`** — useful when the device can't save files easily (e.g. iOS, locked-down browser). Paste into a note or file.
4. Move the file off-device (Drive, iCloud, AirDrop, gist, etc.) before clearing site data or switching devices.

### Option 2 — DevTools snapshot (fallback)

If the menubar `backup` panel is unavailable, open DevTools on the loaded app and run:

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

Clipboard now holds a restore-compatible backup. Save it as `alfgym-backup-YYYY-MM-DD.json`.

### Mobile (iOS / Android) notes

- The download button respects whatever the OS does with `<a download>`: on iOS Safari you'll typically get a "Downloads" entry in Files; on Android you'll get a standard file save.
- If the file save fails silently (some in-app browsers do), use **`copy to clipboard`** and paste into Notes, Drive, or a draft email.
- IndexedDB is per-browser. Data logged in Safari is invisible to Chrome on the same device, and vice versa.

### Restore on another device

1. On the target device open the app and click `backup`.
2. Either pick the `.json` file or paste its contents into the textarea.
3. Click **preview** to see store counts, then **replace all**. This wipes any existing local data — an `undo last restore` button stays visible for one rollback (stashed in `localStorage`).
4. Cross-schema restore is refused. If `schemaVersion` doesn't match, export from the older device on a build that matches the newer one.

### Caveats

- **Clearing site data wipes everything.** No cloud copy exists until Supabase sync ships.
- **Private/Incognito windows** isolate IndexedDB — sessions logged there die with the tab.
- The exported JSON is **not redacted**. Notes fields may contain whatever you typed (injuries, pain marks). Treat it as personal data.

UI additions to make this easier (per-session JSON/Markdown, share sheet, CSV) and the planned migration to PocketBase as canonical storage are tracked in [`docs/export-pocketbase-plan.md`](docs/export-pocketbase-plan.md). Other in-flight plans are indexed in [`docs/plans.md`](docs/plans.md).

## Decisions locked

- Default unit: lb
- App is the system of record; manual markdown export
- Single `Workout` entity at the top. No Program / Variant hierarchy. Lineage via `parentId`. Forking copies content.
- Days have alts as siblings (Day A, Day A alt) grouped via `groupKey`. No separate Day Variant entity.
- No cycle nudge
- Storage is structured; markdown is import/export only
- Hierarchical numbering: `2.1`, `2.2`
- Set entry: prefill + chevron increments + tap-to-type
- Notation v3.1: `;` for per side, `!` stays as user input (notable not derived — r3.1 reversal)
- English mode shows zero syntax tokens
- Syntax toggle is app-wide (menubar)
- Trackers (injury, asymmetry, skill) as a primitive — ships P2
- Global floating new-session button
- Speech: deferred to P4
- Quick edit by prompt: deferred to P3

## Tech direction

**Current prototype (`app/`):** Alpine.js + Dexie (IndexedDB). No build, no bundler.

**Target (`web/`):** SvelteKit + TailwindCSS + Dexie + Supabase, deployed to Vercel. See `docs/migration-sveltekit.md`.

## Conventions

- Notation tokens are first-class. See `docs/notation.md`.
- Commits: `area: short description`. Areas: `spec`, `app`, `web`, `infra`, `docs`, `tests`.
