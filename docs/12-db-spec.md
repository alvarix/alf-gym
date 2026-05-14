# alf-gym — Project Summary
_Last updated: 2026-05-06_

## What this is

A mobile-first PWA for tracking gym sessions. The user designs and tweaks workouts on a laptop, then tracks sessions on a phone. History surfaces last cycle's actuals as prefill when starting a new session.

Core tenet from SPEC: **as little app interaction as possible**. Every screen earns its place.

---

## Current state (r4.2)

The wired app lives at `app/`. Deployed to Vercel (static, no backend).

Working:
- Workout / Day / Block / Prescription builder (full CRUD, reorder, fork, archive)
- Session start → capture → end flow with prefill from last cycle
- En mode and syn mode toggle (discrete fields vs. notation tokens)
- Wishlist, pain marks, mood/env on end
- Day B alt (home) seeded with full prescription data
- Playwright E2E test suite (`npx playwright test`)

Not yet built (from SPEC backlog):
- Day C template not seeded with prescriptions (skeleton blocks only: Warmup, Skill, Diagnostic ISO)
- History views (per-session, per-exercise chart)
- Trackers UI (data model exists, no views)
- Focus view (P2)
- Home screen, Day picker, Settings (P2+)
- Sync / backend (was always planned, not started)

---

## The immediate problem: cross-device

Data lives in IndexedDB (Dexie). IDB is:
- **Per-device, per-browser** — laptop and phone are completely isolated
- **Volatile on mobile** — iOS Safari clears IDB for sites not visited in 7 days, or under storage pressure
- **Not version-controlled** — no recovery if cleared

The SPEC already calls for this (§5):
> "Storage is structured (IndexedDB on device, Postgres in cloud)."

Supabase is the target. It's available via MCP.

---

## Next task: Supabase migration spec

Before any code, the following need decisions:

### Auth
How does the user log in on their phone?
- Option A: Supabase magic link (email) — simplest, no password to forget
- Option B: Hardcoded anon key + RLS scoped to a single user ID — zero-login, but fragile if key leaks
- Option C: Google OAuth — one tap on phone, already authed on laptop

### Offline stance
What happens at the gym with no signal?
- Option A: Fail gracefully — show error, wait for connection. Acceptable if gym has wifi/cell.
- Option B: IDB as write-ahead queue, sync on reconnect — resilient, but significant complexity
- Option C: Read from IDB cache, write to Supabase when online — middle ground

### Schema
IDB tables map cleanly to Postgres. Minor decisions:
- `exercises` is currently a global flat table — stays global (shared across workouts)
- `meta` table (IDB key/value) can become a simple settings row per user
- `wishlist` can be a simple table

### Migration
One-time script to export current IDB data from the browser and import to Supabase. Can be a console script since it only runs once.

### Client layer
Replace all `window.alfdb.*` Dexie calls with Supabase JS client calls. Mostly mechanical — the Alpine component methods each become async fetch operations. No framework change needed.

---

## Pending: Day C template seed

Day C blocks currently have no prescriptions. The full Day C content (from the workout markdown) needs to be seeded into `db.js` so any device running a fresh seed gets it. Structure:

1. **Diagnostic ISO** — 5 ISO holds (wall sit, glute bridge hold, side plank, calf raise, eyes-closed balance). Each: 1 set, holdSec target, unilateral-L-first.
2. **Weighted stretching** — 6 exercises (goblet squat hold, hip flexor stretch, hamstring wall slide, splits progression, staff spine stretches, cossack squat).
3. **Plyos** (optional block) — 3 exercises (SL drop to stick, SL 4-point hop, tuck jump to freeze).
4. **Skill** (existing block) — 7 pick-2-rotate options (capo flow, gungfu stances, low kicks, capo warmup flow, get-up-without-hands, surf popup burpee, handstand wall holds).
5. **Cooldown** (optional block) — bench 90-degree hang.

This seed should be added to `db.js` alongside the existing Day A and Day B alt seeds, not as a console script.

---

## Key files

| File | Purpose |
|---|---|
| `app/db.js` | Dexie schema + seed data |
| `app/app.js` | Alpine component — all reads/writes |
| `app/index.html` | Single-page app shell |
| `SPEC.md` | Living spec — source of truth for domain model and UX |
| `CHANGELOG.md` | Dated history of changes |
| `tests/e2e/session.spec.js` | Playwright E2E suite |
| `vercel.json` | Static deploy config (`outputDirectory: app`) |

---

## Suggested order of work

1. Write Supabase migration spec (auth, offline, schema) — align before coding
2. Seed Day C prescriptions into `db.js` (laptop-only, quick win)
3. Implement Supabase backend + swap Dexie calls
4. One-time IDB → Supabase migration script
5. Resume SPEC phase roadmap (history views, trackers, focus view)
