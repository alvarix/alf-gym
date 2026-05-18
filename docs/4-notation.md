# Notation Reference (v4)

Canonical syntax for prescriptions, sets, pain, mood. Stored as typed fields; rendered back in this notation in syntax mode and exports.

## Tokens

| Token | Meaning | Example |
|---|---|---|
| `n!` | weight, total bar (lb default). `!` is the mandatory load terminator | `115!` |
| `(n)!` | plate per side | `(35)!` |
| `^n!` | cable stack level | `^15!` |
| `:n!` | pair of implements (two DBs, etc.) | `:20!` |
| `n` reps | bilateral | `8` |
| `Ns` after `!` | hold time in seconds (time-based set) | `30s!-3` |
| `:n` after `!` | reps per side (unilateral) | `40!:8-3` |
| `-n` | sets | `-3` |
| `$n L|R region` | pain severity (0-10), side, region | `$3 L hip` |
| `n:)` | mood | `8:)` |
| `+ activity` | aux activity (bike, box) | `+ bike` |

### `:` disambiguation (context-sensitive)

- `:` **before** `!` → pair of implements: `:20!` = two 20lb dumbbells
- `:` **after** `!` → per-side reps: `40!:8-3` = 40lb, 8 reps per side, 3 sets
- `:` standalone (no `!` in token) → per-side reps on bodyweight: `:5-3` = 5 reps per side, 3 sets

### "Notable" is not a typed token

The `!` character marks the end of every load token. It is not a "notable / PR" signal typed by the user. If the app surfaces a "first time at this load" indicator, it is a UI-derived affordance computed from history, not a stored or typed token.

### `;` is not used

Previous drafts included `;` for unilateral. It is removed from the syntax. Use `:` after `!` for per-side reps.

## Examples

| Token | Meaning |
|---|---|
| `40!` | 40lb, no reps/sets specified |
| `40!5-3` | 40lb, 5 reps bilateral, 3 sets |
| `40!:5-3` | 40lb, 5 reps per side, 3 sets |
| `:20!:5-3` | pair of 20lb DBs, 5 reps per side, 3 sets |
| `:20!10-3` | pair of 20lb DBs, 10 reps bilateral, 3 sets |
| `^15!:10-2` | cable stack 15, 10 reps per side, 2 sets |
| `(45)!5-3` | 45lb plate per side, 5 reps bilateral, 3 sets |
| `:5-3` | 5 reps per side, 3 sets, bodyweight |
| `30s!-3` | 30 second hold, 3 sets |
| `30s!:-3` | 30 second hold per side, 3 sets |
| `95!8-3` | 95 lb, 8 reps bilateral, 3 sets |
| `0:8-3` | bodyweight, 8 reps per side, 3 sets |

## Two presentation modes (same data)

- **english**: discrete fields. Weight, reps, sets, side scheme each have their own input.
- **syntax**: one field per exercise. Type the canonical token directly.

The toggle is a UI affordance; storage is identical.

## Block grouping

| Notation | Meaning |
|---|---|
| `( ex1, ex2, ex3 ) -3` | circuit, 3 rounds |
| `> ex` | superset / replacement marker |
| `--> cue` | cue line |
| `--//--` | session separator (legacy PRX) |

## Side schemes

- `bilateral`: no `:` prefix after `!` on rep counts
- `unilateral L-first`: `:n` rep counts after `!`; left side first by convention
- `unilateral R-first`: `:n` rep counts after `!`; right side first
- `alternating`: counts apply to alternating reps

## Pain regions (suggested)

`hip`, `low back`, `mid back`, `upper back`, `knee`, `ankle`, `calf`, `foot`, `shoulder`, `elbow`, `wrist`, `neck`. Free-form supported.

## Compatibility notes

- Pre-v4 data using `;` for unilateral reps is parsed and normalized to `:` (after `!`) on save.
- Pre-v4 data using `!` as a "notable" flag is silently treated as a load terminator; the notable field resets to `false` on import.
