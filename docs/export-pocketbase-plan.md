# Plan E — Export UI + PocketBase migration

Status: draft, 2026-05-14. Owner: Alvar. Supersedes the earlier scoped-import bridge sketched in conversation; we go direct to PocketBase because the droplet is already provisioned.

## Why this exists

Two related problems, sequenced:

1. **Getting individual sessions out** of the app for review, share-to-coach, or analysis. The current full-DB JSON dump is correct for cross-device migration and wrong for everything else. Per-session shapes + better mobile delivery solve this.
2. **The actual sync problem.** alf-gym lives in IndexedDB on whichever device wrote each row. Templates evolve on the computer, sessions are logged on the phone. Today there is no automatic flow between them; tomorrow there is PocketBase.

Phase 1 solves problem 1 standalone. Phase 2 solves problem 2 and outlives Phase 1 (Phase 1 features remain useful even with PB).

## Non-goals

- Markdown re-import. Notation roundtrip is a separate doc.
- Multi-user / sharing / public links. Single user, single droplet.
- Server-side conflict resolution. The disjoint-tables property (phone writes sessions only; computer writes templates only) means there is nothing to merge at the row level. We assume it holds until evidence says otherwise.
- Encryption at rest beyond what PocketBase + Digital Ocean already provide.

---

## Phase 1 — Session export, share sheet, editable date, JSON-panel fix

Self-contained UI work, no schema bump. Each item independently useful.

### 1.1 Per-session export (JSON + Markdown)

**Where.** New `Export` row inside each session card on `#/sessions`, plus on the live session "end" screen. Two buttons per row: `.json`, `.md`.

**JSON shape.** Read-only self-contained subset for one session:

```json
{
  "app": "alf-gym",
  "schemaVersion": 5,
  "exportType": "session",
  "exportedAt": "...",
  "session": { /* sessions row */ },
  "performances": [ /* for this sessionId */ ],
  "sets": [ /* joined via performanceId */ ],
  "painMarks": [ /* for this sessionId */ ],
  "context": {
    "workout": { /* workouts row */ },
    "day": { /* days row */ },
    "blocks": [ /* referenced by this session */ ],
    "exercises": [ /* referenced subset, not the full library */ ]
  }
}
```

Restore explicitly refuses `exportType: 'session'` so a stray session file never lands as a replace-all. Today's check at `app/app.js:1502` is a string match on `parsed.app` only — extend it.

**Markdown shape.** Renders the session as one document. Respects current `syntax` toggle (`docs/notation.md`). Includes planned-vs-actual deltas inline, e.g. `8 → 8`, `10 → 9 ✗`.

**File naming.** `alfgym-session-{dayName-slug}-{YYYY-MM-DD-HHmm}.{json,md}`.

### 1.2 Share Sheet on mobile

Single shared helper, used by every export path (full backup, session JSON, session MD, later CSV):

```js
async function downloadOrShare(body, filename, mime) {
  const file = new File([body], filename, { type: mime });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: filename });
    return;
  }
  // existing blob + <a download> fallback
}
```

On iOS: native share sheet, one tap to Drive / Mail / Notes. On desktop: unchanged. Visible button labels do not need to change; the OS labels the action.

### 1.3 Editable session date

Today `startedAt` is hardstamped at `app/app.js:215`:

```js
startedAt: new Date().toISOString(),
```

Required for two real use cases:

- **Forgot to log live.** "I trained yesterday, entering it now."
- **Manual recreate.** Reconstructing pre-backup-button sessions without them all landing on today.

**UI.**
- On session start: date picker defaulting to now. Most starts accept the default.
- On a completed session card: small `edit date` affordance that updates `startedAt` (and proportionally `endedAt` if set).

No schema change — the field already exists.

### 1.4 JSON debug panel: dump IndexedDB, not Alpine state

Today the `json` button shows the Alpine in-memory state, which on the workouts-list view contains `workouts` populated but `days/blocks/prescriptions/exercises` empty (loaded lazily per workout). This already misled in production — looked like missing data when nothing was missing.

**Fix.** Wire the panel to `buildBackup()` so it shows the actual stored state, not the in-memory subset. Same code path as the download button; the panel becomes a live read of canonical data.

Add a small label distinguishing intent: "Stored (IndexedDB)" vs an optional "View state (Alpine)" toggle for the original behaviour — useful for debugging reactive bugs, but not the default.

### 1.5 CSV export

Two flat files appended to the existing `backup` panel under **`Export CSV`**:

- **`sets.csv`** — one row per logged set. Columns: `sessionId, sessionStartedAt, dayName, blockName, exerciseName, performanceId, setIndex, side, reps, load, holdSec, rpe, notable, notes`.
- **`performances.csv`** — one row per prescription-run. Columns: `sessionId, sessionStartedAt, dayName, blockName, blockType, exerciseName, prescribedSets, prescribedReps, prescribedLoad, prescribedSideScheme, prescribedHoldSec, prescribedNotable, totalSetsLogged, totalRepsLogged`.

In-memory joins, ~30-line RFC 4180 quoter, no deps.

### Phase 1 implementation notes

- New methods alongside current backup code (`app/app.js:1456-1571`): `buildSessionExport(sessionId)`, `renderSessionMarkdown(exp)`, `downloadOrShare(body, filename, mime)`, `buildSetsCsv()`, `buildPerformancesCsv()`.
- Reuse `BACKUP_STORES`, `BACKUP_SCHEMA_VERSION`. Add `EXPORT_TYPES = ['full', 'session']`.
- Guard `confirmImport`: refuse `exportType !== 'full'` with a clear message.

### Phase 1 testing

- Playwright: log a session via existing harness; assert session `.json` parses to exactly one session with matching `sets`/`performances`. Snapshot test on the rendered Markdown.
- Manual on iOS Safari + Android Chrome: share-sheet path; download fallback on desktop without `navigator.canShare`.
- CSV: round-trip through a spreadsheet with notes containing commas and newlines.

---

## Phase 2 — PocketBase migration

PocketBase is already running on a Digital Ocean droplet. Auth is deferred. Offline reliability is **not** deferred — losing signal mid-set cannot lose the set.

### 2.1 Architecture: write-through Dexie + PB sync

Dexie stays as the authoritative local store during a live session. PocketBase is the canonical remote and the only thing two devices share. Sync is best-effort and asynchronous.

```
write path:
  UI → Dexie (sync, authoritative)
     → mark row dirty
     → background flush to PB (best-effort, retries on reconnect)

read path:
  app start  → if online, pull delta from PB into Dexie
             → render from Dexie
  live use   → render from Dexie (PB is never on the critical path)
```

A dropped connection mid-set is invisible to the user. Reconnect drains the dirty queue. Worst case: a row sits dirty for hours until the device reconnects. Acceptable.

### 2.2 Schema mirror

Mirror the 12 IndexedDB stores as PocketBase collections, same field names. Add three columns on every row:

- `updated_at` — PB sets on every write
- `deleted_at` — soft-delete marker; sync respects it
- `client_id` — random per-device, useful for debugging origin (not required for correctness)

Keep PB's auto-id as the canonical cross-device identity. The existing Dexie autoincrement `id` becomes a separate `local_id` field on the Dexie side so we can map without collision.

### 2.3 Data-layer abstraction

Today Dexie calls are spread across `app.js`. Introduce a thin repo layer:

```
app/data/
  index.js          // public API: workouts, days, blocks, sessions, ...
  dexieAdapter.js   // current behaviour
  pbAdapter.js      // PocketBase SDK calls
  syncQueue.js      // dirty rows, flush, retry
```

Swap call sites incrementally. Each store gets migrated independently. The dual-write period lets us catch divergence before cutting over.

### 2.4 One-time migration

Use the Phase 1 full-backup JSON as the migration vehicle:

1. Export full JSON from each device that has authoritative data (phone for sessions, computer for templates).
2. Local Node script (`scripts/migrate-to-pb.js`) reads both files, dedupes templates by name + parent lineage, inserts into PocketBase via SDK.
3. Devices then run a one-time "bootstrap from PB" that wipes their local Dexie and re-pulls from canonical.

Bootstrap is destructive locally but the data exists on the server first, so it's recoverable.

### 2.5 Auth (deferred, but not forgotten)

Run PB behind a single-user setup for now — droplet on a non-obvious port + basic-auth at the reverse-proxy layer, or a long-random API key in the app. Do **not** leave PB's collection API publicly readable; even without proper auth, hide it.

Real auth (email/password or magic link via PB) is a one-day add when needed.

### 2.6 Things explicitly NOT in Phase 2

- Row-level conflict resolution. Disjoint-tables makes the common path safe; if real conflicts appear, revisit.
- Realtime subscribe. Pull-on-app-start + push-on-write is enough. PB supports realtime; add it when "device A sees device B's edit instantly" is a real need.
- Migration UI in the app. Migration is a one-shot via local script.

### 2.7 Phase 2 risks

- **Dexie ↔ PB schema drift.** Any field added one side must be added the other. Mitigate via a single `schema.js` that both adapters import.
- **Dirty queue lost on tab close.** Persist the queue in IndexedDB itself, not in memory, so a phone tab swiped away mid-flush survives.
- **Clock skew between devices.** `updated_at` is set server-side on writes; do not trust client clocks for ordering.

### Phase 2 testing

- Local: spin up a throwaway PB instance in Docker; full migration round-trip on a copy of real data.
- Offline: airplane-mode mid-session, verify writes persist, reconnect, verify dirty queue drains.
- Stress: simulate 200 sets pending, drain, verify no duplicates.

---

## Sequencing

1. **Phase 1.3** (editable date) and **1.4** (JSON panel fix) — small, immediately useful, no schema risk.
2. **Phase 1.1, 1.2, 1.5** — session export, share sheet, CSV.
3. **Phase 2** — start with the data-layer abstraction and a single store (e.g. `wishlist`) migrated end-to-end as a thin slice. Expand store by store.

## Out-of-scope follow-ups

- PDF render of a session (browser print path, no code).
- Direct push to Google Drive / Dropbox without going through OS share sheet.
- iCal export of completed sessions.
