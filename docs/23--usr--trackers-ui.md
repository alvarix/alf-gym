# 23 — Trackers UI — Tasks

**Estimated effort:** 5–7 hours (v1: list + form + chip + session banner ≈ 5h; v1.1 pain-mark linkage +2h)

Data layer exists (`db.trackers`, 3 seed rows). No screen renders them.

## Tasks
- [ ] List view at `#/trackers` (mirrors `#/wishlist` pattern)
- [ ] Add tracker form: name, kind (`injury | asymmetry | skill`), status, severity, side, notes
- [ ] Edit a tracker inline
- [ ] Archive / restore tracker
- [ ] Menubar chip with active count (mirrors `★` wishlist chip)
- [ ] Surface in session capture view (placement TBD — see decisions)
- [ ] Link `$ pain` mark to a tracker (optional, defer to v1.1)

## Decisions needed
- [ ] Add `createdAt` / `resolvedAt` fields now (schema bump) or after UI ships
- [ ] Severity scale: 1–3, 1–5, or free-text
- [ ] In-session UX: persistent header banner, expandable panel, or buried under a button
- [ ] Trackers global vs per-workout (current schema is global — keep)

## Ruled out
- Charts / timeline rendering — v1 is a flat list

## Feedback
(fill in after testing)
