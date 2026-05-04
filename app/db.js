// alf-gym local store. Dexie over IndexedDB.
// Schema reflects SPEC v3.1 domain model.

const db = new Dexie('alfgym');

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

// Skeletons for new days, per the SPEC v3.1 starter pattern.
window.DAY_SKELETONS = {
  A: ['Warmup', 'Squat', 'Push', 'Anti-Rotation', 'Plyo'],
  B: ['Warmup', 'Hinge', 'Lunge', 'Pull', 'Hips', 'Rotation'],
  C: ['Warmup', 'Skill', 'Diagnostic ISO']
};

// Idempotent seed: if any program exists, skip.
async function seedIfEmpty() {
  const existing = await db.programs.toArray();
  if (existing.length > 0) return;

  await db.transaction('rw',
    [db.programs, db.variants, db.days, db.blocks, db.exercises, db.prescriptions, db.trackers, db.meta],
    async () => {

      const programId = await db.programs.add({
        name: 'Workout 9', status: 'active', createdAt: new Date().toISOString()
      });
      const variantId = await db.variants.add({
        programId, name: '9.2', isCurrent: 1, createdAt: new Date().toISOString()
      });

      // Days: Day A (filled), Day A alt (empty for practice), Day B and C (skeleton)
      const dayA    = await db.days.add({ variantId, groupKey: 'A', name: 'Day A - Front',    isAlt: 0, order: 1 });
      const dayAalt = await db.days.add({ variantId, groupKey: 'A', name: 'Day A alt - home', isAlt: 1, order: 2 });
      const dayB    = await db.days.add({ variantId, groupKey: 'B', name: 'Day B - Back',     isAlt: 0, order: 3 });
      const dayC    = await db.days.add({ variantId, groupKey: 'C', name: 'Day C - Skills + Diagnostics', isAlt: 0, order: 4 });

      // Exercise library
      const ex = {};
      const addEx = async (name, parentId, category, equipment) => {
        ex[name] = await db.exercises.add({ name, parentId: parentId || null, category, equipment });
      };
      await addEx('BSS',                                       null,     'lunge',    'any');
      await addEx('Smith machine BSS',                          ex.BSS,   'lunge',    'smith');
      await addEx('Tempo BSS with DBs',                         ex.BSS,   'lunge',    'db');
      await addEx("World's greatest stretch",                   null,     'mobility', 'none');
      await addEx('Banded monster walks',                       null,     'glute',    'band');
      await addEx('Single-leg balance, eyes closed',            null,     'balance',  'none');
      await addEx('Single-leg forward hop to stick',            null,     'plyo',     'none');
      await addEx('Zercher squat',                              null,     'squat',    'bar');
      await addEx('Cable woodchop high-to-low',                 null,     'rotation', 'cable');
      await addEx('Cross cable Y raise',                        null,     'shoulder', 'cable');
      await addEx('Light cable face pull',                      null,     'shoulder', 'cable');
      await addEx('Seated bent-knee calf raise',                null,     'calf',     'machine');
      await addEx('Eccentric calf raise off step',              null,     'calf',     'step');
      await addEx('Banded dorsiflexion mob',                    null,     'mobility', 'band');
      await addEx('KB clean to front squat',                    null,     'kb',       'kb');
      await addEx('KB figure 8',                                null,     'kb',       'kb');
      await addEx('Sprawl',                                     null,     'plyo',     'none');

      // Day A blocks (filled)
      const b1 = await db.blocks.add({ dayId: dayA, name: 'Warmup',         type: 'linear', order: 1 });
      const b2 = await db.blocks.add({ dayId: dayA, name: 'Anchor',         type: 'linear', order: 2 });
      const b3 = await db.blocks.add({ dayId: dayA, name: 'Anti-Rotation',  type: 'linear', order: 3 });
      const b4 = await db.blocks.add({ dayId: dayA, name: 'KB compound',    type: 'circuit', rounds: 3, restBetweenRoundsSec: 90, order: 4 });
      const b5 = await db.blocks.add({ dayId: dayA, name: 'Shoulder ramp',  type: 'linear', order: 5 });
      const b6 = await db.blocks.add({ dayId: dayA, name: 'Calf PT',        type: 'linear', order: 6 });

      const presc = (blockId, exerciseId, fields, order) =>
        db.prescriptions.add({ blockId, exerciseId, order, ...fields });

      // Warmup
      await presc(b1, ex["World's greatest stretch"],            { sets: 1, reps: 5,  sideScheme: 'unilateral-L-first', load: '' }, 1);
      await presc(b1, ex['Banded monster walks'],                { sets: 2, reps: 12, sideScheme: 'alternating',         load: 'band' }, 2);
      await presc(b1, ex['Single-leg balance, eyes closed'],     { sets: 1, reps: null, holdSec: 30, sideScheme: 'unilateral-L-first', load: '' }, 3);
      await presc(b1, ex['Single-leg forward hop to stick'],     { sets: 3, reps: 3,  sideScheme: 'unilateral-L-first', load: '' }, 4);
      // Anchor
      await presc(b2, ex['Smith machine BSS'],                   { sets: 3, reps: '8,10,12', sideScheme: 'unilateral-L-first', load: '50,50,50' }, 1);
      await presc(b2, ex['Zercher squat'],                       { sets: 3, reps: 8,  sideScheme: 'bilateral', load: '70' }, 2);
      // Anti-Rotation
      await presc(b3, ex['Cable woodchop high-to-low'],          { sets: 3, reps: 10, sideScheme: 'unilateral-L-first', load: '^15' }, 1);
      // KB circuit
      await presc(b4, ex['KB clean to front squat'],             { sets: 3, reps: 6,  sideScheme: 'unilateral-L-first', load: '35' }, 1);
      await presc(b4, ex['KB figure 8'],                         { sets: 3, reps: 10, sideScheme: 'bilateral', load: '35' }, 2);
      await presc(b4, ex['Sprawl'],                              { sets: 3, reps: 8,  sideScheme: 'bilateral', load: '' }, 3);
      // Shoulder ramp
      await presc(b5, ex['Cross cable Y raise'],                 { sets: 2, reps: 10, sideScheme: 'bilateral', load: '^3' }, 1);
      await presc(b5, ex['Light cable face pull'],               { sets: 2, reps: 12, sideScheme: 'bilateral', load: '^35' }, 2);
      // Calf PT
      await presc(b6, ex['Seated bent-knee calf raise'],         { sets: 3, reps: 12, sideScheme: 'unilateral-L-first', load: '85' }, 1);
      await presc(b6, ex['Eccentric calf raise off step'],       { sets: 3, reps: 8,  sideScheme: 'unilateral-L-first', load: '45' }, 2);
      await presc(b6, ex['Banded dorsiflexion mob'],             { sets: 2, reps: null, holdSec: 30, sideScheme: 'unilateral-L-first', load: 'band' }, 3);

      // Day A alt: leave empty so the user has a free practice canvas.

      // Day B and C: skeleton blocks, no prescriptions yet.
      const seedSkeleton = async (dayId, key) => {
        const list = window.DAY_SKELETONS[key] || ['Warmup'];
        for (let i = 0; i < list.length; i++) {
          await db.blocks.add({ dayId, name: list[i], type: 'linear', order: i + 1 });
        }
      };
      await seedSkeleton(dayB, 'B');
      await seedSkeleton(dayC, 'C');

      // Trackers (placeholder; views ship in P2)
      await db.trackers.add({ name: 'L hip strain',                kind: 'injury',     status: 'active', severity: 2, side: 'L', notes: 'aware on BSS' });
      await db.trackers.add({ name: 'L vs R single-leg balance',   kind: 'asymmetry',  status: 'active', severity: null, side: null, notes: 'L 2-4s before slip on 4/16' });
      await db.trackers.add({ name: 'Eyes-closed balance',         kind: 'skill',      status: 'active', severity: null, side: null, notes: 'diagnostic constant' });

      await db.meta.put({ key: 'seeded', value: new Date().toISOString() });
    }
  );
}

// Reset everything (used by Reset button in the JSON panel).
async function resetAll() {
  await Promise.all([
    db.programs.clear(),
    db.variants.clear(),
    db.days.clear(),
    db.blocks.clear(),
    db.exercises.clear(),
    db.prescriptions.clear(),
    db.trackers.clear(),
    db.meta.clear()
  ]);
  await seedIfEmpty();
}

window.alfdb = db;
window.alfdbSeed = seedIfEmpty;
window.alfdbReset = resetAll;
