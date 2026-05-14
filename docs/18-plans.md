# Plans index

Active and proposed plans, in rough sequence. Newest first. Each plan lives in its own file so it can evolve without merge pain; this file is the only place that orders them.

## Conventions

- One letter per plan (`Plan E`, `Plan F`, …) appended to the file name root for a stable handle.
- Status flags: **draft** (still being designed), **active** (work in progress), **done** (shipped — leave as historical reference), **parked** (deferred indefinitely).
- "Sequencing" inside each plan describes the order of items *within* that plan. This index describes the order *across* plans.

## Active / proposed

| # | Plan | File | Status | One-liner |
|---|---|---|---|---|
| E | Export UI + PocketBase migration | [`export-pocketbase-plan.md`](export-pocketbase-plan.md) | draft | Per-session JSON/Markdown export, share sheet on mobile, editable session date, JSON-panel fix, then PocketBase as canonical storage with Dexie as offline cache. |
| F | Floating toolbar (quick-capture) | [`floating-toolbar-plan.md`](floating-toolbar-plan.md) | draft | Always-on bottom-right toolbar with one-tap wishlist add and freestanding notes (date-keyed, optional session pin, room for future "global lines" syntax). |

## Suggested order across plans

1. **Plan E Phase 1.3 + 1.4** — editable session date and JSON-panel fix. Tiny, immediately useful, no schema risk.
2. **Plan F Feature 1** — wishlist quick-add. No schema change, biggest capture-friction win.
3. **Plan E Phase 1.1 / 1.2 / 1.5** — session export, share sheet, CSV. Unblocks coach-sharing and analysis.
4. **Plan F Feature 2** — notes table. First Dexie schema bump (v6); rolls into existing backup roundtrip.
5. **Plan E Phase 2** — PocketBase migration. Largest piece; depends on the data shape stabilising through 1–4.

Reordering is fine if a real need surfaces — this is a suggestion, not a contract.

## Historical reference

Shipped work is captured in [`../CHANGELOG.md`](../CHANGELOG.md) and the phase handoffs (`handoff.md`, `handoff-phase-c.md`, `handoff-phase-d.md`).
