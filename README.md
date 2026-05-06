# alf-gym

A mobile-first PWA for tracking gym sessions. Offline-first, fast capture, history that surfaces last cycle's output as you log this cycle's.

## Status

r4.0 — sessions capture flow complete. Builder (workouts, days, blocks, exercises, wishlist) and session capture (start, live set entry, pain marks, end with mood/env) all working. Next: r4.1 prefill last-cycle actuals + chevron increments.

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
