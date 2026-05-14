# Notation Reference (v3)

Canonical syntax for prescriptions, sets, pain, mood. Stored as typed fields; rendered back in this notation in syntax mode and exports.

## Tokens

| Token | Meaning | Example |
|---|---|---|
| `n` | weight, total bar (lb default) | `115` |
| `(n)` | plate per side | `(35)` |
| `^n` | cable stack level | `^15` |
| `!` | notable, first time at this load (manual) | `50!` |
| `n` reps | bilateral | `8` |
| `;n` | reps per side | `;8` |
| `ns` | seconds (time hold) | `30s` |
| `ns;` | per-side time hold | `30s;` |
| `-n` / `-III` | sets | `-3` |
| `$n L|R region` | pain severity (0-10), side, region | `$3 L hip` |
| `n:)` | mood | `8:)` |
| `+ activity` | aux activity (bike, box) | `+ bike` |

Compatibility:
- `:` in legacy data (where it meant per-side reps) is parsed and normalized to `;` on save.
- `:)` mood and time-prefix `:` (in legacy contexts) are kept for display compatibility.
- `!` may also be auto-suggested by the app when a load exceeds the prior recorded max for that exercise/variation; user accepts or rejects.

## Examples

| Token | Meaning |
|---|---|
| `95!;8-3` | 95 lb (notable), 8 reps per side, 3 sets |
| `0;8,35!;6` | bodyweight x 8 per side, then 35 lb (notable) x 6 per side |
| `^15;10-2` | cable stack 15, 10 reps per side, 2 sets |
| `(45);5-3` | 45 lb plate per side, 5 reps per side, 3 sets |
| `30s;-3` | 30 second hold per side, 3 sets |

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

- `bilateral`: no `:` prefix on rep counts
- `unilateral L-first`: `:n` rep counts; left side first by convention
- `unilateral R-first`: `:n` rep counts; right side first
- `alternating`: counts apply to alternating reps

## Pain regions (suggested)

`hip`, `low back`, `mid back`, `upper back`, `knee`, `ankle`, `calf`, `foot`, `shoulder`, `elbow`, `wrist`, `neck`. Free-form supported.
