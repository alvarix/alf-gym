# 24 — Floating-toolbar items 3–4 — LLM spec

**Estimated effort:** 5–6.5 hours total.
- B1 — session-card notes surface: 1–1.5h
- B2 — calendar / journal view: 4–5h (route + month grid + day-detail + menubar entry)

Item 5 (global-lines syntax parser) **dropped**. Distinct from the markdown template importer (`docs/27--*--md-import.md`) — it parses sigils inside *note bodies*, not programme structure. The original plan flagged it as "do not build yet"; no user signal has motivated it since.

Companion: `docs/24--usr--floating-toolbar-3-5.md`. Continuation of `docs/17-floating-toolbar-plan.md`.

## Goal

Finish the three deferred items from Plan F: session-card review surfaces, calendar/journal view, and global-lines syntax parser.

## Architecture baseline (verified)

- Plan source: `docs/17-floating-toolbar-plan.md` (sequencing in lines 129–135).
- Notes table exists (added in the floating-bar commit `b3df90c`).
- Wishlist exists at `#/wishlist` (`app/index.html:828-863`).
- Sessions list at `#/sessions` renders cards; no notes/wishlist surface yet.
- No calendar route — would be a new view in `app.js` view-switch.

## Plan

| # | Item | Effort | Risk |
|---|------|--------|------|
| B1 | Session-card notes surface | small | low — rendering only |
| B2 | `#/calendar` month grid | medium | low |
| B2.1 | Day-detail drill-in | small | low |

Recommended order: B1 → B2.

## Open questions

1. **Calendar surface** — `#/calendar` or a swap-in panel on the sessions list?
2. **B1 grouping** — notes by `sessionId` only, or also by `date` matching the session's `startedAt`?
