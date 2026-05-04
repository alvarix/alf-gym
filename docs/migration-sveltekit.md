# SvelteKit Migration Plan

Target: replace `app/` (Alpine + Dexie + IndexedDB) with `web/` (SvelteKit + Dexie + Supabase, deployed to Vercel).

## Why SvelteKit

- **File-based routing** with real URLs out of the box. The hash router in `app/` is workable but limiting.
- **Reactive forms** via `$state` and `bind:` cut a lot of the manual Alpine wiring.
- **Static-adapter PWA** still possible: builds to a static bundle, deployable on Vercel or any CDN, installable on phones.
- **Smaller bundles** than React for the same surface area.
- **Server endpoints** (`+page.server.ts`, `+server.ts`) when we want them, optional otherwise.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | SvelteKit | File routing, reactive forms, light bundle |
| Hosting | Vercel | One-click SvelteKit deploys, edge functions if needed |
| Auth + DB (cloud) | Supabase | Postgres + magic-link auth + realtime |
| Local store | Dexie + IndexedDB | Offline cache, outbox |
| Sync | Hand-rolled (LWW + outbox + `updatedAt`/`syncRev`) | Single-user keeps it tractable |
| UI | TailwindCSS | Quick layout, no design-system overhead |
| Forms | Native + Zod for validation | Type-safe boundaries |
| PWA | `@vite-pwa/sveltekit` | Manifest, service worker, install prompt |

## Folder structure

```
web/
  src/
    routes/
      +layout.svelte                  Menubar, en/syn toggle, FAB
      +page.svelte                    Programs list
      wizard/+page.svelte             New-program wizard
      v/[variantId]/+page.svelte      Variant: Days list
      v/[variantId]/d/[dayId]/+page.svelte         Day: Blocks list
      v/[variantId]/d/[dayId]/b/[blockId]/+page.svelte  Block: Exercises list
      session/+page.svelte            Active session (capture)
      session/[sessionId]/+page.svelte Session detail / history day
      history/+page.svelte            History overview
      history/exercise/[exerciseId]/+page.svelte
      settings/+page.svelte
    lib/
      db/
        local.ts                      Dexie schema + seed
        cloud.ts                      Supabase client + tables
        sync.ts                       Outbox drain, pull, conflict resolution
      stores/
        auth.ts                       User, session
        prefs.ts                      en/syn, units, default view
      domain/
        notation.ts                   Token parser, formatter
        skeletons.ts                  Day skeleton presets
      components/
        EmptyState.svelte
        InlineEditRow.svelte
        ExerciseOmnibox.svelte
        BlockCard.svelte
        DayCard.svelte
        SyntaxToggle.svelte
        Fab.svelte
        Flash.svelte
  static/
    icons/                            PWA icons
    manifest.webmanifest
  package.json
  svelte.config.js
  tailwind.config.js
  README.md
```

## Migration steps

1. **Scaffold:** `pnpm create svelte@latest web` (or `npm create`). Pick SvelteKit, TypeScript, ESLint, Prettier, Vitest, Playwright.
2. **Tailwind + PWA plugins:** add `tailwindcss`, `@vite-pwa/sveltekit`, `dexie`, `@supabase/supabase-js`, `zod`.
3. **Port domain types:** copy the Dexie schema from `app/db.js` into `web/src/lib/db/local.ts` with TypeScript types.
4. **Port skeletons + notation:** `app/db.js` `DAY_SKELETONS` and `app/app.js` `toSyntax` / `toEnglish` move to `web/src/lib/domain/`.
5. **Build the routes** in this order:
   1. `+layout.svelte` (menubar, syntax toggle, FAB)
   2. `/` programs list
   3. `/wizard` new-program flow
   4. `/v/[variantId]` days
   5. `/v/[variantId]/d/[dayId]` blocks
   6. `/v/[variantId]/d/[dayId]/b/[blockId]` exercises (inline edit)
6. **Auth:** Supabase magic-link sign-in. Settings page.
7. **Cloud schema:** mirror IndexedDB schema in Supabase Postgres with RLS scoped to user_id.
8. **Sync engine:** outbox drain on online events; pull diff by `updatedAt` ascending.
9. **Sessions feature:** `/session/+page.svelte`. Tap a Day in variant view to start a session against it.
10. **History:** `/history`, `/history/exercise/[id]`.
11. **PWA:** manifest, install prompt, service worker.
12. **Polish:** drag-reorder via `svelte-dnd-action`, alts list per exercise, cues editor, variation branching.
13. **Deploy:** `vercel --prod`. Supabase live.

## Sync model details

Outbox rows: `{ id, table, op, payload, createdAt, attemptedAt? }`.
Drain on `online` event and on app focus. Each op is `INSERT`, `UPDATE`, or `DELETE` against the matching Supabase table.

Pull: `select * from <table> where updated_at > :lastSync and user_id = :uid`. Apply LWW. Update lastSync.

Conflict detection: for each updated row in the pull, if the local row's `updatedAt > pulledRow.updatedAt`, prefer local; the next outbox drain will push it. If `pulledRow.updatedAt > localUpdatedAt`, replace local. Single-user makes this almost lossless in practice.

## Open migration questions

1. **Move `app/` aside or delete?** Recommend keep at `app/` as a frozen reference until `web/` reaches feature parity, then archive.
2. **Type system:** TypeScript fully, or pragmatic JSDoc on `.js` files? Recommend TS.
3. **Style:** Tailwind, or carry over the hand-written `styles.css`? Tailwind is faster long-term.
4. **State:** Svelte stores, runes (`$state`), or a query lib like TanStack Query? Recommend runes for local state, no remote query lib at first.
5. **Tests:** Vitest for units (notation, sync resolver), Playwright for E2E (install + offline + capture). Add early.
