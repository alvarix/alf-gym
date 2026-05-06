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
      const dayA    = await db.days.add({ workoutId: w92, groupKey: 'A', name: 'Day A - Front',        isAlt: 0, order: 1 });
      const dayAalt = await db.days.add({ workoutId: w92, groupKey: 'A', name: 'Day A alt - home',     isAlt: 1, order: 2 });
      const dayB    = await db.days.add({ workoutId: w92, groupKey: 'B', name: 'Day B - Back',          isAlt: 0, order: 3 });
      const dayBalt = await db.days.add({ workoutId: w92, groupKey: 'B', name: 'Day B alt - home',     isAlt: 1, order: 4 });
      const dayC    = await db.days.add({ workoutId: w92, groupKey: 'C', name: 'Day C - Skills + Diagnostics', isAlt: 0, order: 5 });

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

      // Day B alt exercises.
      await addEx('Bear crawl',                            null,    'mobility', 'none');
      await addEx('Shinbox to Farmer\'s Squat',            null,    'mobility', 'none');
      await addEx('Single-leg hip thrust off bench',       null,    'glute',    'bench');
      await addEx('DB RDL',                                null,    'hinge',    'db');
      await addEx('DB B-stance RDL',                       ex['DB RDL'], 'hinge', 'db');
      await addEx('Heavy bag combo',                       null,    'conditioning', 'bag');
      await addEx('Band woodchop low-to-high',             ex['Cable woodchop high-to-low'], 'rotation', 'band');
      await addEx('Banded hip CARs',                       null,    'mobility', 'band');
      await addEx('Nordic hamstring curl',                 null,    'hinge',    'bench');
      await addEx('Single-leg glute bridge',               null,    'glute',    'none');
      await addEx('Heavy sled push',                       null,    'conditioning', 'sled');

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

      // Day B alt blocks. Equipment: bench, DBs ≤50, pull-up bar, bands, bag, sled.
      const ba1 = await db.blocks.add({ dayId: dayBalt, name: 'Warmup',         type: 'linear',  order: 1 });
      const ba2 = await db.blocks.add({ dayId: dayBalt, name: 'Hinge pair',     type: 'linear',  order: 2 });
      const ba3 = await db.blocks.add({ dayId: dayBalt, name: 'KB compound',    type: 'circuit', rounds: 3, restBetweenRoundsSec: 90, order: 3 });
      const ba4 = await db.blocks.add({ dayId: dayBalt, name: 'Rotation',       type: 'linear',  order: 4 });
      const ba5 = await db.blocks.add({ dayId: dayBalt, name: 'Hips',           type: 'linear',  order: 5 });
      const ba6 = await db.blocks.add({ dayId: dayBalt, name: 'Soccer prehab',  type: 'linear',  order: 6 });
      const ba7 = await db.blocks.add({ dayId: dayBalt, name: 'Bonus',          type: 'linear',  optional: true, order: 7 });

      await presc(ba1, ex['Bear crawl'],                    { sets: 2, reps: null, holdSec: null, sideScheme: 'bilateral', load: '', notes: '20 yards each, slow. Knees 1 inch off ground.' }, 1);
      await presc(ba1, ex['Shinbox to Farmer\'s Squat'],    { sets: 1, reps: 8,   sideScheme: 'unilateral-L-first', load: '', notes: 'L gets 2 extra. Fluid hip rotation.' }, 2);
      await presc(ba1, ex['Single-leg hip thrust off bench'],{ sets: 2, reps: 8,  sideScheme: 'unilateral-L-first', load: '', notes: 'Full range glute activation.' }, 3);

      await presc(ba2, ex['DB RDL'],                        { sets: 2, reps: 8,   sideScheme: 'bilateral', load: '50', notes: 'Heaviest DBs. Same cues as barbell.' }, 1);
      await presc(ba2, ex['DB B-stance RDL'],               { sets: 3, reps: 8,   sideScheme: 'unilateral-L-first', load: '50', notes: 'One or two DBs.' }, 2);

      await presc(ba3, ex['KB clean to front squat'],       { sets: 3, reps: 8,   sideScheme: 'unilateral-L-first', load: '25', notes: 'Lighter bell, more reps.' }, 1);
      await presc(ba3, ex['KB figure 8'],                   { sets: 3, reps: 12,  sideScheme: 'bilateral', load: '25', notes: '6 each direction.' }, 2);
      await presc(ba3, ex['Heavy bag combo'],                { sets: 3, reps: null, holdSec: 30, sideScheme: 'bilateral', load: '', notes: 'Jab-cross-hook-body, reset. Alt: sprawl to knee strike x8.' }, 3);

      await presc(ba4, ex['Band woodchop low-to-high'],     { sets: 3, reps: 10,  sideScheme: 'unilateral-L-first', load: 'band', notes: 'Anchor band low on pull-up bar base.' }, 1);

      await presc(ba5, ex['Banded hip CARs'],               { sets: 2, reps: 5,   sideScheme: 'unilateral-L-first', load: 'band', notes: 'Slow full circles.' }, 1);

      await presc(ba6, ex['Nordic hamstring curl'],          { sets: 3, reps: 5,   sideScheme: 'bilateral', load: '', notes: 'Eccentric focus (4-6 reps). Anchor feet under bench.' }, 1);
      await presc(ba6, ex['Single-leg glute bridge'],        { sets: 3, reps: 8,   sideScheme: 'unilateral-L-first', load: '', holdSec: 3, notes: '3s hold at top.' }, 2);

      await presc(ba7, ex['Heavy sled push'],                { sets: 4, reps: null, holdSec: null, sideScheme: 'bilateral', load: '', notes: '30 yards per set.' }, 1);

      // Skeleton blocks for Day B (main — no prescriptions yet).
      const seedSkeleton = async (dayId, key) => {
        const list = window.DAY_SKELETONS[key] || ['Warmup'];
        for (let i = 0; i < list.length; i++) {
          await db.blocks.add({ dayId, name: list[i], type: 'linear', order: i + 1 });
        }
      };
      await seedSkeleton(dayB, 'B');

      // Day C exercises.
      await addEx('Single-leg wall sit',                        null,    'diagnostic', 'none');
      await addEx('Single-leg glute bridge hold',               null,    'diagnostic', 'none');
      await addEx('Side plank with top leg lift',               null,    'diagnostic', 'none');
      await addEx('Single-leg calf raise hold at top',          null,    'diagnostic', 'none');
      await addEx('Eyes-closed single-leg balance',             null,    'diagnostic', 'none');
      await addEx('Deep goblet squat hold',                     null,    'mobility',   'kb');
      await addEx('Half-kneeling hip flexor stretch with KB',   null,    'mobility',   'kb');
      await addEx('Hamstring wall slide',                       null,    'mobility',   'none');
      await addEx('Splits progression',                         null,    'mobility',   'none');
      await addEx('Staff spine stretches',                      null,    'mobility',   'none');
      await addEx('Cossack squat',                              null,    'mobility',   'none');
      await addEx('Single-leg drop to stick',                   null,    'plyo',       'none');
      await addEx('Single-leg 4-point hop to stick',            null,    'plyo',       'none');
      await addEx('Tuck jump to freeze',                        null,    'plyo',       'none');
      await addEx('Capo flow',                                  null,    'skill',      'none');
      await addEx('5 gungfu stances',                           null,    'skill',      'none');
      await addEx('Low kicks',                                  null,    'skill',      'none');
      await addEx('Capo warmup flow',                           null,    'skill',      'none');
      await addEx('Get-up-without-hands drill',                 null,    'skill',      'none');
      await addEx('Surf popup burpee',                          null,    'skill',      'none');
      await addEx('Handstand wall holds',                       null,    'skill',      'none');
      await addEx('Bench 90-degree hang',                       null,    'mobility',   'bench');

      // Day C blocks.
      const bc0 = await db.blocks.add({ dayId: dayC, name: 'Warmup',             type: 'linear', optional: false, order: 1 });
      const bc1 = await db.blocks.add({ dayId: dayC, name: 'Diagnostic ISO',     type: 'linear', optional: false, order: 2 });
      const bc2 = await db.blocks.add({ dayId: dayC, name: 'Weighted stretching',type: 'linear', optional: false, order: 3 });
      const bc3 = await db.blocks.add({ dayId: dayC, name: 'Plyos',              type: 'linear', optional: true,  order: 4 });
      const bc4 = await db.blocks.add({ dayId: dayC, name: 'Skill',              type: 'linear', optional: true,  order: 5 });
      const bc5 = await db.blocks.add({ dayId: dayC, name: 'Cooldown',           type: 'linear', optional: true,  order: 6 });

      // Diagnostic ISOs — max hold each side, log time weekly.
      await presc(bc1, ex['Single-leg wall sit'],           { sets: 1, reps: null, holdSec: 30, sideScheme: 'unilateral-L-first', load: '', notes: 'Max hold each side, log time. Alt: single-leg squat hold at 90 deg' }, 1);
      await presc(bc1, ex['Single-leg glute bridge hold'],  { sets: 1, reps: null, holdSec: 30, sideScheme: 'unilateral-L-first', load: '', notes: '30s target. Note when hips drop. Alt: SL hip thrust off bench, hold 20s' }, 2);
      await presc(bc1, ex['Side plank with top leg lift'],  { sets: 1, reps: null, holdSec: 20, sideScheme: 'unilateral-L-first', load: '', notes: '20s each side. Glute med endurance. Alt: Copenhagen hold 20s each side' }, 3);
      await presc(bc1, ex['Single-leg calf raise hold at top'], { sets: 1, reps: null, holdSec: 15, sideScheme: 'unilateral-L-first', load: '', notes: '15s each side, note shake onset. Alt: SL forefoot balance eyes open 30s' }, 4);
      await presc(bc1, ex['Eyes-closed single-leg balance'],{ sets: 1, reps: null, holdSec: 30, sideScheme: 'unilateral-L-first', load: '', notes: '30s each side, barefoot. Weekly constant.' }, 5);

      // Weighted stretching — loaded positions held for time.
      await presc(bc2, ex['Deep goblet squat hold'],        { sets: 3, reps: null, holdSec: 30, sideScheme: 'bilateral',         load: '', notes: 'KB or DB goblet. Drive knees out, chest tall. Alt: BW squat hold with band pull-apart 3x30s' }, 1);
      await presc(bc2, ex['Half-kneeling hip flexor stretch with KB'], { sets: 3, reps: null, holdSec: 30, sideScheme: 'unilateral-L-first', load: '', notes: 'Right side twice. Alt: couch stretch 3x30s each side' }, 2);
      await presc(bc2, ex['Hamstring wall slide'],          { sets: 3, reps: null, holdSec: 30, sideScheme: 'unilateral-L-first', load: '', notes: 'Alt: elevated single-leg forward fold 3x20s' }, 3);
      await presc(bc2, ex['Splits progression'],            { sets: 1, reps: null, holdSec: null, sideScheme: 'bilateral',       load: '', notes: '' }, 4);
      await presc(bc2, ex['Staff spine stretches'],         { sets: 2, reps: null, holdSec: null, sideScheme: 'bilateral',       load: '', notes: '2 rounds: kneeling rotation 5s, standing 10s, flags 10s' }, 5);
      await presc(bc2, ex['Cossack squat'],                 { sets: 3, reps: 6,    holdSec: null, sideScheme: 'unilateral-L-first', load: '', notes: 'Slow, deep lateral shift. Chest tall, heel down. Alt: 90/90 active lift-off 3x8/side' }, 6);

      // Plyos (optional) — single-leg stick focus.
      await presc(bc3, ex['Single-leg drop to stick'],      { sets: 3, reps: 5, sideScheme: 'unilateral-L-first', load: '', notes: 'L first. Step off low box, land same foot, freeze 3s. No push-off. Alt: SL squat jump to stick 3x4/side' }, 1);
      await presc(bc3, ex['Single-leg 4-point hop to stick'], { sets: 3, reps: 4, sideScheme: 'unilateral-L-first', load: '', notes: '1 rep = hop F/R/B/L, stick 2s each. Keep hips level. Alt: SL clock taps 3x2 full clocks/side' }, 2);
      await presc(bc3, ex['Tuck jump to freeze'],           { sets: 3, reps: 5, sideScheme: 'bilateral',           load: '', notes: 'Max height, land both feet, freeze 3s. Alt: broad jump to stick 3x5' }, 3);

      // Skill (optional) — pick 2, rotate.
      await presc(bc4, ex['Capo flow'],                     { sets: 1, reps: null, sideScheme: 'bilateral', load: '', notes: 'Ginga, esquiva flow, au practice. Pick 2, rotate.' }, 1);
      await presc(bc4, ex['5 gungfu stances'],              { sets: 1, reps: null, sideScheme: 'bilateral', load: '', notes: 'Pick 2, rotate.' }, 2);
      await presc(bc4, ex['Low kicks'],                     { sets: 1, reps: null, sideScheme: 'bilateral', load: '', notes: 'Pick 2, rotate.' }, 3);
      await presc(bc4, ex['Capo warmup flow'],              { sets: 1, reps: null, sideScheme: 'bilateral', load: '', notes: 'Pick 2, rotate.' }, 4);
      await presc(bc4, ex['Get-up-without-hands drill'],    { sets: 1, reps: null, sideScheme: 'bilateral', load: '', notes: 'Pick 2, rotate.' }, 5);
      await presc(bc4, ex['Surf popup burpee'],             { sets: 1, reps: null, sideScheme: 'bilateral', load: '', notes: 'Pick 2, rotate.' }, 6);
      await presc(bc4, ex['Handstand wall holds'],          { sets: 1, reps: null, sideScheme: 'bilateral', load: '', notes: 'Only when shoulder green-lit. Pick 2, rotate.' }, 7);

      // Cooldown (optional).
      await presc(bc5, ex['Bench 90-degree hang'],          { sets: 1, reps: null, holdSec: 60, sideScheme: 'bilateral', load: '', notes: 'No arch, round lower back, target lower lat. Hold obliques on exhale, breathe into upper chest. Alt: child\'s pose with side reaches 1 min' }, 1);

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
