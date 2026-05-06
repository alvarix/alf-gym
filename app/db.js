// alf-gym local store. Dexie over IndexedDB.
// Schema reflects SPEC v3.3: Program + Variant flattened into single Workout.

const db = new Dexie('alfgym');

// v1 + v2 are the old schema (programs + variants); v3 flattens.
db.version(2).stores({
  programs:      '++id, name, status, createdAt',
  variants:      '++id, programId, name, isCurrent, createdAt',
  days:          '++id, variantId, groupKey, name, isAlt, order',
  blocks:        '++id, dayId, name, type, rounds, restBetweenRoundsSec, order',
  exercises:     '++id, name, parentId, category, equipment',
  prescriptions: '++id, blockId, exerciseId, sets, reps, load, sideScheme, order, notes',
  trackers:      '++id, name, kind, status, severity, side, notes',
  meta:          '&key'
});

// v3: drop programs and variants. Add workouts. Days now reference workoutId.
db.version(3).stores({
  programs:      null,
  variants:      null,
  workouts:      '++id, name, parentId, status, isCurrent, createdAt',
  days:          '++id, workoutId, groupKey, name, isAlt, order',
  blocks:        '++id, dayId, name, type, rounds, restBetweenRoundsSec, order',
  exercises:     '++id, name, parentId, category, equipment',
  prescriptions: '++id, blockId, exerciseId, sets, reps, load, sideScheme, order, notes',
  trackers:      '++id, name, kind, status, severity, side, notes',
  meta:          '&key'
});

// v4: add wishlist table.
db.version(4).stores({
  wishlist:      '++id, exerciseName, createdAt'
});

// v5: sessions and capture data.
db.version(5).stores({
  sessions:     '++id, dayId, workoutId, startedAt, endedAt, status, mood, env',
  performances: '++id, sessionId, prescriptionId, exerciseId, blockId, order',
  sets:         '++id, performanceId, setIndex',
  painMarks:    '++id, sessionId, performanceId, ts'
});

// Day skeletons by group key.
window.DAY_SKELETONS = {
  A: ['Warmup', 'Squat', 'Push', 'Anti-Rotation', 'Plyo'],
  B: ['Warmup', 'Hinge', 'Lunge', 'Pull', 'Hips', 'Rotation'],
  C: ['Warmup', 'Skill', 'Diagnostic ISO']
};

// Idempotent seed: skip if any workout exists.
async function seedIfEmpty() {
  const existing = await db.workouts.toArray();
  if (existing.length > 0) return;

  await db.transaction('rw',
    [db.workouts, db.days, db.blocks, db.exercises, db.prescriptions, db.trackers, db.meta],
    async () => {

      // Two workouts seeded to demonstrate lineage. "Workout 9" is the archived
      // ancestor; "Workout 9.2" is the current revision (parentId points at 9).
      const w9 = await db.workouts.add({
        name: 'Workout 9', parentId: null, status: 'archived', isCurrent: 0,
        createdAt: '2026-03-14T00:00:00Z'
      });
      const w92 = await db.workouts.add({
        name: 'Workout 9.2', parentId: w9, status: 'active', isCurrent: 1,
        createdAt: new Date().toISOString()
      });

      // Days under 9.2.
      const dayA    = await db.days.add({ workoutId: w92, groupKey: 'A', name: 'Day A - Front',    isAlt: 0, order: 1 });
      const dayAalt = await db.days.add({ workoutId: w92, groupKey: 'A', name: 'Day A alt - home', isAlt: 1, order: 2 });
      const dayB    = await db.days.add({ workoutId: w92, groupKey: 'B', name: 'Day B - Back',     isAlt: 0, order: 3 });
      const dayC    = await db.days.add({ workoutId: w92, groupKey: 'C', name: 'Day C - Skills + Diagnostics', isAlt: 0, order: 4 });

      // Exercise library.
      const ex = {};
      const addEx = async (name, parentId, category, equipment) => {
        ex[name] = await db.exercises.add({ name, parentId: parentId || null, category, equipment });
      };
      await addEx('BSS',                                   null,    'lunge',    'any');
      await addEx('Smith machine BSS',                     ex.BSS,  'lunge',    'smith');
      await addEx('Tempo BSS with DBs',                    ex.BSS,  'lunge',    'db');
      await addEx("World's greatest stretch",              null,    'mobility', 'none');
      await addEx('Banded monster walks',                  null,    'glute',    'band');
      await addEx('Single-leg balance, eyes closed',       null,    'balance',  'none');
      await addEx('Single-leg forward hop to stick',       null,    'plyo',     'none');
      await addEx('Zercher squat',                         null,    'squat',    'bar');
      await addEx('Cable woodchop high-to-low',            null,    'rotation', 'cable');
      await addEx('Cross cable Y raise',                   null,    'shoulder', 'cable');
      await addEx('Light cable face pull',                 null,    'shoulder', 'cable');
      await addEx('Seated bent-knee calf raise',           null,    'calf',     'machine');
      await addEx('Eccentric calf raise off step',         null,    'calf',     'step');
      await addEx('Banded dorsiflexion mob',               null,    'mobility', 'band');
      await addEx('KB clean to front squat',               null,    'kb',       'kb');
      await addEx('KB figure 8',                           null,    'kb',       'kb');
      await addEx('Sprawl',                                null,    'plyo',     'none');

      // Day A blocks.
      const b1 = await db.blocks.add({ dayId: dayA, name: 'Warmup',         type: 'linear', order: 1 });
      const b2 = await db.blocks.add({ dayId: dayA, name: 'Anchor',         type: 'linear', order: 2 });
      const b3 = await db.blocks.add({ dayId: dayA, name: 'Anti-Rotation',  type: 'linear', order: 3 });
      const b4 = await db.blocks.add({ dayId: dayA, name: 'KB compound',    type: 'circuit', rounds: 3, restBetweenRoundsSec: 90, order: 4 });
      const b5 = await db.blocks.add({ dayId: dayA, name: 'Shoulder ramp',  type: 'linear', order: 5 });
      const b6 = await db.blocks.add({ dayId: dayA, name: 'Calf PT',        type: 'linear', order: 6 });

      const presc = (blockId, exerciseId, fields, order) =>
        db.prescriptions.add({ blockId, exerciseId, order, ...fields });

      await presc(b1, ex["World's greatest stretch"],      { sets: 1, reps: 5,    sideScheme: 'unilateral-L-first', load: '' }, 1);
      await presc(b1, ex['Banded monster walks'],          { sets: 2, reps: 12,   sideScheme: 'alternating',        load: 'band' }, 2);
      await presc(b1, ex['Single-leg balance, eyes closed'], { sets: 1, reps: null, holdSec: 30, sideScheme: 'unilateral-L-first', load: '' }, 3);
      await presc(b1, ex['Single-leg forward hop to stick'], { sets: 3, reps: 3,  sideScheme: 'unilateral-L-first', load: '' }, 4);
      await presc(b2, ex['Smith machine BSS'],             { sets: 3, reps: '8,10,12', sideScheme: 'unilateral-L-first', load: '50,50,50' }, 1);
      await presc(b2, ex['Zercher squat'],                 { sets: 3, reps: 8,   sideScheme: 'bilateral', load: '70' }, 2);
      await presc(b3, ex['Cable woodchop high-to-low'],    { sets: 3, reps: 10,  sideScheme: 'unilateral-L-first', load: '^15' }, 1);
      await presc(b4, ex['KB clean to front squat'],       { sets: 3, reps: 6,   sideScheme: 'unilateral-L-first', load: '35' }, 1);
      await presc(b4, ex['KB figure 8'],                   { sets: 3, reps: 10,  sideScheme: 'bilateral', load: '35' }, 2);
      await presc(b4, ex['Sprawl'],                        { sets: 3, reps: 8,   sideScheme: 'bilateral', load: '' }, 3);
      await presc(b5, ex['Cross cable Y raise'],           { sets: 2, reps: 10,  sideScheme: 'bilateral', load: '^3' }, 1);
      await presc(b5, ex['Light cable face pull'],         { sets: 2, reps: 12,  sideScheme: 'bilateral', load: '^35' }, 2);
      await presc(b6, ex['Seated bent-knee calf raise'],   { sets: 3, reps: 12,  sideScheme: 'unilateral-L-first', load: '85' }, 1);
      await presc(b6, ex['Eccentric calf raise off step'], { sets: 3, reps: 8,   sideScheme: 'unilateral-L-first', load: '45' }, 2);
      await presc(b6, ex['Banded dorsiflexion mob'],       { sets: 2, reps: null, holdSec: 30, sideScheme: 'unilateral-L-first', load: 'band' }, 3);

      // Skeleton blocks for B and C.
      const seedSkeleton = async (dayId, key) => {
        const list = window.DAY_SKELETONS[key] || ['Warmup'];
        for (let i = 0; i < list.length; i++) {
          await db.blocks.add({ dayId, name: list[i], type: 'linear', order: i + 1 });
        }
      };
      await seedSkeleton(dayB, 'B');
      await seedSkeleton(dayC, 'C');

      // Trackers (data-only; UI in P2).
      await db.trackers.add({ name: 'L hip strain',              kind: 'injury',    status: 'active', severity: 2,    side: 'L',  notes: 'aware on BSS' });
      await db.trackers.add({ name: 'L vs R single-leg balance', kind: 'asymmetry', status: 'active', severity: null, side: null, notes: 'L 2-4s before slip on 4/16' });
      await db.trackers.add({ name: 'Eyes-closed balance',       kind: 'skill',     status: 'active', severity: null, side: null, notes: 'diagnostic constant' });

      await db.meta.put({ key: 'seeded', value: new Date().toISOString() });
    }
  );
}

async function resetAll() {
  await Promise.all([
    db.workouts.clear(),
    db.days.clear(),
    db.blocks.clear(),
    db.exercises.clear(),
    db.prescriptions.clear(),
    db.trackers.clear(),
    db.wishlist.clear(),
    db.sessions.clear(),
    db.performances.clear(),
    db.sets.clear(),
    db.painMarks.clear(),
    db.meta.clear()
  ]);
  await seedIfEmpty();
}

window.alfdb = db;
window.alfdbSeed = seedIfEmpty;
window.alfdbReset = resetAll;
