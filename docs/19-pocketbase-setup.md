# PocketBase setup — alf-gym

One-time manual work in the PocketBase Admin UI (or via the API). Do this before starting Plan E Phase 2 code.

**URL:** your droplet's PB instance (Admin UI → `/_/`)

---

## 1. Auth

PocketBase ships with a `users` collection. For now we're doing single-user, no real auth flow:

1. Go to **Collections → users → Settings**.
2. Disable public sign-up (`Allow email/password sign-up → OFF`).
3. Create one user manually: **Settings → Admins → + New admin**, or use the `users` collection directly with `Create record`. Set a strong password. Note the email — this is the account the sync client will use.
4. No OAuth providers needed yet.

API rule summary for every collection (set in steps below):
- List/View: `@request.auth.id != ""`
- Create/Update/Delete: `@request.auth.id != ""`

This blocks all anonymous access. The sync client authenticates as that user and gets a token.

---

## 2. Sync columns (add to EVERY collection)

Every collection below gets these three extra fields beyond the domain fields:

| Field | PB type | Notes |
|---|---|---|
| `updated_at` | Auto date | PB sets on every write — do not send from client |
| `deleted_at` | Date (nullable) | Soft-delete marker. Client sets on logical delete |
| `client_id` | Plain text (nullable) | Random per-device string, helps debug origin |

PocketBase adds its own `id` (CUID) and `created` fields automatically — leave them. The Dexie autoincrement `id` is mapped to a separate `local_id` field that lives **only in Dexie** (not in PB); the sync layer handles the mapping.

---

## 3. Collections

Create each collection below. Name must match exactly — the sync adapter references them by name.

### 3.1 `workouts`

| Field | PB type | Required |
|---|---|---|
| `name` | Plain text | yes |
| `parentId` | Plain text (nullable) | no — stores PB id of parent workout |
| `status` | Plain text | yes — values: `active`, `archived` |
| `isCurrent` | Number | no — 0 or 1 |
| `createdAt` | Plain text | yes — ISO string set by client |
| + sync columns | | |

### 3.2 `days`

| Field | PB type | Required |
|---|---|---|
| `workoutId` | Plain text | yes — PB id of parent workout |
| `groupKey` | Plain text | yes — `A`, `B`, `C`, `D` |
| `name` | Plain text | yes |
| `isAlt` | Bool | no |
| `order` | Number | yes |
| + sync columns | | |

### 3.3 `blocks`

| Field | PB type | Required |
|---|---|---|
| `dayId` | Plain text | yes |
| `name` | Plain text | yes |
| `type` | Plain text | yes — `linear`, `circuit` |
| `rounds` | Number (nullable) | no |
| `restBetweenRoundsSec` | Number (nullable) | no |
| `optional` | Bool | no |
| `order` | Number | yes |
| + sync columns | | |

### 3.4 `exercises`

| Field | PB type | Required |
|---|---|---|
| `name` | Plain text | yes |
| `parentId` | Plain text (nullable) | no — PB id of parent exercise |
| `category` | Plain text | no |
| `equipment` | Plain text | no |
| + sync columns | | |

### 3.5 `prescriptions`

| Field | PB type | Required |
|---|---|---|
| `blockId` | Plain text | yes |
| `exerciseId` | Plain text | yes |
| `sets` | Number | no |
| `reps` | Plain text (nullable) | no — can be `"8,10,12"` or `"8"` or null |
| `load` | Plain text (nullable) | no |
| `sideScheme` | Plain text | no — `bilateral`, `unilateral-L-first`, `alternating` |
| `holdSec` | Number (nullable) | no |
| `notable` | Bool | no |
| `order` | Number | yes |
| `notes` | Plain text (nullable) | no |
| + sync columns | | |

### 3.6 `sessions`

| Field | PB type | Required |
|---|---|---|
| `dayId` | Plain text | yes |
| `workoutId` | Plain text | yes |
| `startedAt` | Plain text | yes — ISO string |
| `endedAt` | Plain text (nullable) | no |
| `status` | Plain text | yes — `in_progress`, `completed` |
| `mood` | Number (nullable) | no — 1–5 |
| `env` | Plain text (nullable) | no — `gym`, `home`, `park`, `other` |
| `note` | Plain text (nullable) | no |
| + sync columns | | |

### 3.7 `performances`

Snapshot of the prescription at the time the session ran. Fields are denormalised intentionally so the session is self-contained even if templates change later.

| Field | PB type | Required |
|---|---|---|
| `sessionId` | Plain text | yes |
| `prescriptionId` | Plain text (nullable) | no — null for ad-hoc adds |
| `exerciseId` | Plain text | yes |
| `exerciseName` | Plain text | yes |
| `blockId` | Plain text | yes |
| `blockName` | Plain text | yes |
| `blockType` | Plain text | yes |
| `blockOptional` | Bool | no |
| `blockRounds` | Number (nullable) | no |
| `blockRestBetweenRoundsSec` | Number (nullable) | no |
| `order` | Number | yes |
| `prescribedSets` | Number | no |
| `prescribedReps` | Plain text (nullable) | no |
| `prescribedLoad` | Plain text (nullable) | no |
| `prescribedSideScheme` | Plain text | no |
| `prescribedHoldSec` | Number (nullable) | no |
| `prescribedNotable` | Bool | no |
| `notes` | Plain text (nullable) | no |
| + sync columns | | |

### 3.8 `sets`

| Field | PB type | Required |
|---|---|---|
| `performanceId` | Plain text | yes |
| `setIndex` | Number | yes |
| `reps` | Plain text (nullable) | no |
| `load` | Plain text (nullable) | no |
| `side` | Plain text (nullable) | no — `L`, `R`, `both`, `""` |
| `holdSec` | Number (nullable) | no |
| `notable` | Bool | no |
| `done` | Bool | no |
| `prefilled` | Bool | no |
| `notes` | Plain text (nullable) | no |
| + sync columns | | |

### 3.9 `painMarks`

| Field | PB type | Required |
|---|---|---|
| `sessionId` | Plain text | yes |
| `performanceId` | Plain text | yes |
| `severity` | Number | yes — 1–5 |
| `side` | Plain text (nullable) | no |
| `region` | Plain text (nullable) | no |
| `ts` | Plain text | yes — ISO string |
| + sync columns | | |

### 3.10 `trackers`

| Field | PB type | Required |
|---|---|---|
| `name` | Plain text | yes |
| `kind` | Plain text | yes — `injury`, `asymmetry`, `skill` |
| `status` | Plain text | yes — `active`, `resolved` |
| `severity` | Number (nullable) | no — 1–5 |
| `side` | Plain text (nullable) | no |
| `notes` | Plain text (nullable) | no |
| + sync columns | | |

### 3.11 `wishlist`

| Field | PB type | Required |
|---|---|---|
| `exerciseName` | Plain text | yes |
| `notes` | Plain text (nullable) | no |
| `createdAt` | Plain text | yes — ISO string |
| + sync columns | | |

### 3.12 `meta`

Stores app-level key/value state (e.g. `seeded`, `lastSyncedAt`).

| Field | PB type | Required |
|---|---|---|
| `key` | Plain text (unique index) | yes |
| `value` | Plain text (nullable) | no |
| + sync columns | | |

For `key` uniqueness: in Collection settings, under **Indexes**, add a unique index on `key`.

---

## 4. API rules for every collection

In each collection's **API Rules** tab, set all four rules to:

```
@request.auth.id != ""
```

This means: authenticated users only, no record-level ownership check (single-user app, all records belong to the same person).

---

## 5. Verify

After creating all 12 collections:

1. Open the PB API preview for `workouts`. Hit **List** — should return 403 (no token) if rules are set.
2. Authenticate via the API: `POST /api/collections/users/auth-with-password` with your email/password. Get a token back.
3. Retry the list with `Authorization: Bearer <token>` — should return `{"items": [], "totalItems": 0}`.
4. That's all PocketBase needs. The migration script and sync adapter are handled in code (Plan E Phase 2).

---

## Notes

- Do **not** add relations (PB's Relation type) between collections. The sync layer manages FK-style joins by storing PB ids as plain text. PB relations add complexity (cascade rules, expand syntax) that isn't needed for a single-user sync.
- `updated_at` should be set to **Auto date** so PB always stamps it server-side, regardless of what the client sends. Clock-skew between devices is a known risk; server-side timestamps are the mitigation.
- The `notes` field on `wishlist` was added in the floating toolbar feature (Plan F). If you created the collection before that, add it as a nullable plain text field.
