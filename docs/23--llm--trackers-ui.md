# 23 — Trackers UI — LLM spec

**Estimated effort:** 5–7 hours total.
- List view + route: 1h
- Add / edit form (inline draft): 1.5h
- Archive / restore: 0.5h
- Menubar chip: 0.5h
- Session header banner: 1.5h
- (v1.1) Pain-mark → tracker linkage: 2h — defer

Companion: `docs/23--usr--trackers-ui.md`.

## Goal

Build a minimal UI for the existing `trackers` table so injuries / asymmetries / skills can be added, viewed, and surfaced during sessions.

## Architecture baseline (verified)

- `db.js:14, 27` — schema: `++id, name, kind, status, severity, side, notes`
- `db.js:249-251` — 3 seed rows (`L hip strain`, `L vs R single-leg balance`, `Eyes-closed balance`)
- No reads or writes from `app.js`
- Wishlist provides the pattern to copy: list view, add form, menubar chip, FAB integration

## Plan

| # | Item | Effort | Risk |
|---|------|--------|------|
| 1 | `#/trackers` route + list view | small | low |
| 2 | Add / edit form (inline draft like wishlist) | small | low |
| 3 | Status toggle (active / archived) | small | low |
| 4 | Menubar chip with `trackers.active.count` | small | low |
| 5 | Session header banner: active trackers, collapsible | medium | low — needs UX call |
| 6 | (v1.1) Pain-mark → tracker linkage | medium | medium — schema change to `painMarks` |

## Open questions

1. Schema additions: `createdAt`, `resolvedAt`, `targetMetric`? Easier to add now than after UI ships.
2. In-session placement — persistent banner risks crowding; behind-a-button risks invisibility. A collapsed-by-default `▸ trackers (3)` row in the session header is the conservative middle.
3. Severity is currently `severity (integer | null)`. Pick a scale or accept free integers.
