# alf-gym

A mobile-first PWA for tracking gym sessions. Offline-first, fast capture, history that surfaces last cycle's output as you log this cycle's.

## Status

Pre-build. Spec and HTML mockup phase. Phased plan (P1-P4) in `SPEC.md` section 0.

## Repo layout

```
SPEC.md         living planning document
CHANGELOG.md    dated entries describing what changed in spec or mockup
README.md       you are here
docs/           durable documentation (notation, decisions, architecture)
tests/          test plan; populated when app code lands
mockup-v1/      round-1 mockup (20 views, preserved for compare)
mockup-v2/      round-2 P1 MVP mockup (cut to ~10 views)
app/            round-3 wired Template Builder (Alpine + Dexie)
mockup/         alias of the v1 nav hub
```

## Run

Static, no build:

```
# wired Template Builder
cd app && python3 -m http.server 8000
# then http://localhost:8000

# v2 mockup site
cd mockup-v2 && python3 -m http.server 8001
# then http://localhost:8001
```

Or open the relevant `index.html` directly in a browser.

## Decisions locked

- Default unit: lb
- App is the system of record; manual markdown export
- Days have alts as siblings (Day A, Day A alt) grouped via `groupKey`. No separate Day Variant entity.
- No cycle nudge
- Storage is structured; markdown is import/export only
- Hierarchical numbering: `2.1`, `2.2`
- Set entry: prefill + chevron increments + tap-to-type
- Notation v3: `;` for per side, `!` dropped (notable derived)
- English mode shows zero syntax tokens
- Syntax toggle is app-wide (menubar)
- Trackers (injury, asymmetry, skill) as a primitive
- Global floating new-session button
- Speech: deferred to P4
- Quick edit by prompt: deferred to P3

## Tech direction

Alpine.js, htmx for sync. Dexie over IndexedDB. Workbox service worker. Supabase for cloud sync (single-user). Vite build.

## Conventions

- Notation tokens are first-class. See `docs/notation.md`.
- Commits: `area: short description`. Areas: `spec`, `mockup`, `app`, `infra`, `docs`, `tests`.
