# Architecture

Tech stack rationale and tradeoffs. Pre-build; revise once code lands.

## Frontend

**Alpine.js** for reactivity. Lightweight (~15 KB), declarative, fits a static-shell PWA without a build dependency. Component model is light-touch: `x-data`, `x-show`, `x-for`, `x-text`. Good fit for a single-user app where state is mostly local component-scoped.

**htmx** for sync routes. Server-rendered partial swaps for any list that benefits from server logic (history overview pulls from Supabase Postgres function). Minimal JS for these flows.

**No SPA framework.** No React, Vue, Svelte, or SolidJS in the critical path. The app is small enough that route handling can be hash-based or file-based across `views/`. Add a framework only if state complexity outgrows Alpine.

## Storage

**Dexie** as the IndexedDB wrapper. Schema migrations, query API. Production-grade.

**Zod** at the storage boundary. Every read and write validated against the typed schema. Cheap insurance against drift.

**Schema versioning:** monotonic integer. Migrations live in `app/storage/migrations/`. Failed migration on device = recovery via JSON export (always available locally).

## Service worker

**Workbox** generated config, hand-tuned. App shell is precached. API responses use `StaleWhileRevalidate`. Background Sync API for outbox drain. Wake Lock during active session.

## Sync (cloud)

**Supabase** for auth, Postgres, and storage. Magic-link email login. Single-user only at v1; auth is mostly to scope cloud rows.

Sync engine: per-record `updatedAt` + `syncRev`. LWW conflict resolution. Daily snapshot at 02:00 local as the safety net. Manual export anywhere.

**Why Supabase:** managed Postgres + Auth + RLS removes a lot of glue code. Edge Functions available if Whisper-based speech becomes a P4 feature.

## Build

**Vite.** Single-page shell, `views/` rendered by file or hash route. Production output is static; deploy anywhere (Vercel, Cloudflare Pages, Netlify, Caddy on a VPS).

## Tradeoffs and risks

- **htmx + offline:** htmx is request-response. Offline writes go to IndexedDB via Alpine, not htmx. htmx is reserved for sync paths where the server is reachable.
- **Single-user assumption:** simplifies storage, sync, and conflict handling. Multi-user is a substantial v2+ shift.
- **iOS standalone PWA quirks:** speech, install prompt, wake lock can all behave differently from Safari tab. Test early on real iOS.
- **No framework:** if the app's interaction graph grows beyond ~30 views or starts needing complex shared state, reconsider. Alpine is fine for now.

## Testing approach (planned)

- **Unit:** Vitest. Pure functions: notation parser, syncRev resolver, prefill calculator.
- **Integration:** Vitest + happy-dom for components.
- **E2E:** Playwright for the install + offline + capture loop.
- **Visual regression:** Playwright screenshots of each view in `mockup-v*/`. Catches accidental layout drift.
