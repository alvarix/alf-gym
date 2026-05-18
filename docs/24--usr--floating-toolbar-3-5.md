# 24 — Floating-toolbar items 3–4 — Tasks

**Estimated effort:** 5–6.5 hours total. B1 ≈ 1–1.5h · B2 ≈ 4–5h.

From `docs/17-floating-toolbar-plan.md`. Items 1–2 (wishlist FAB, notes) shipped in r4.6 and the free-floating-bar commit. Item 5 (global-lines syntax parser) is **dropped** — see "Ruled out" below.

> Disambiguation: the global-lines syntax parser is **not** the markdown template importer (`docs/27--*--md-import.md`). It parses sigils like `#pain:` / `#cue:` inside note bodies. The template importer is a separate concern.

## B1. Review surfaces on session cards
- [ ] Render notes pinned to a session on its `#/sessions` card
- [ ] Render wishlist context hint when a wishlist item was acted on during the session

## B2. Calendar / journal view
- [ ] New route `#/calendar` (or `#/journal`)
- [ ] Month grid
- [ ] Day cell shows session dot + note dot
- [ ] Tap a day → list of sessions and notes for that day
- [ ] Menubar entry point

## Decisions needed
- [ ] B2 first cut: month-only or week + month
- [ ] B1: render notes inline, or expand-on-tap

## Ruled out
- Charts on the calendar — v1 is just presence dots
- **Global-lines syntax parser** (was B3) — speculative, the plan doc itself says "do not build yet". Template importing is handled by docs/27. Inline sigils inside notes can wait for a real-user demand.

## Feedback
(fill in after testing)
