// E2E tests for Phase B: partial sessions (add/remove exercise mid-session
// with three-way scope: session-only / template / fork).
// Run: npx playwright test partial-session.spec.js

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8000';

async function waitForAlpine(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data]');
    return el && el._x_dataStack;
  }, { timeout: 5000 });
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', e => console.error('Page error:', e.message));
  await page.goto(BASE);
  await waitForAlpine(page);
  await page.evaluate(() => window.alfdbReset());
  await page.goto(BASE);
  await waitForAlpine(page);
});

/**
 * Start a session for the first day of the current workout, return useful ids.
 */
async function startFirstSession(page) {
  return await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const days = await window.alfdb.days.toArray();
    const day = days.sort((a, b) => a.order - b.order)[0];
    await app.startSessionForDay(day.id);
    // Wait for session and performances to be hydrated.
    while (!app.activeSession || !app.activeSessionPerformances.length) await new Promise(r => setTimeout(r, 30));
    return {
      sessionId: app.activeSessionId,
      workoutId: app.activeSession.workoutId,
      dayId: day.id,
      firstBlockId: app.activeSessionPerformances[0].blockId
    };
  });
}

test('add exercise — session only: new performance, no new prescription', async ({ page }) => {
  const { firstBlockId } = await startFirstSession(page);

  const result = await page.evaluate(async (blockId) => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const presBefore = await window.alfdb.prescriptions.where({ blockId }).count();
    const perfsBefore = app.activeSessionPerformances.length;

    app.openSessionAdd(blockId);
    app.sessionAdd.exerciseQuery = 'Tempo BSS with DBs'; // exists in seed
    app.sessionAdd.sets = 2;
    app.sessionAdd.reps = 10;
    app.sessionAdd.load = '40';
    await app.commitSessionAdd('session');

    const presAfter = await window.alfdb.prescriptions.where({ blockId }).count();
    const perfsAfter = app.activeSessionPerformances.length;
    const newPerf = app.activeSessionPerformances.find(p => p.exerciseName === 'Tempo BSS with DBs');
    return { presBefore, presAfter, perfsBefore, perfsAfter, newPerf };
  }, firstBlockId);

  expect(result.presAfter).toBe(result.presBefore); // template untouched
  expect(result.perfsAfter).toBe(result.perfsBefore + 1); // session has new perf
  expect(result.newPerf).toBeTruthy();
  expect(result.newPerf.prescriptionId).toBeNull();
  expect(result.newPerf.blockId).toBe(firstBlockId);
  expect(result.newPerf._sets.length).toBe(2);
});

test('add exercise — template: prescription created and performance linked', async ({ page }) => {
  const { firstBlockId } = await startFirstSession(page);

  const result = await page.evaluate(async (blockId) => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const presBefore = await window.alfdb.prescriptions.where({ blockId }).count();

    app.openSessionAdd(blockId);
    app.sessionAdd.exerciseQuery = 'Brand new exercise X';
    app.sessionAdd.sets = 3;
    app.sessionAdd.reps = 5;
    app.sessionAdd.load = '60';
    await app.commitSessionAdd('template');

    const presAfter = await window.alfdb.prescriptions.where({ blockId }).toArray();
    const newPerf = app.activeSessionPerformances.find(p => p.exerciseName === 'Brand new exercise X');
    return {
      presBefore,
      presAfter: presAfter.length,
      newPerf,
      newPrescription: presAfter.find(p => p.exerciseId === newPerf.exerciseId) || null
    };
  }, firstBlockId);

  expect(result.presAfter).toBe(result.presBefore + 1);
  expect(result.newPerf).toBeTruthy();
  expect(result.newPerf.prescriptionId).not.toBeNull();
  expect(result.newPrescription).toBeTruthy();
  expect(result.newPrescription.id).toBe(result.newPerf.prescriptionId);
});

test('add exercise — fork: new workout, session re-pointed, prescription in fork', async ({ page }) => {
  const { firstBlockId, workoutId: originalWorkoutId } = await startFirstSession(page);

  const result = await page.evaluate(async ({ originalWorkoutId, firstBlockId }) => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const workoutsBefore = await window.alfdb.workouts.count();
    const presOriginalBefore = await window.alfdb.prescriptions.where({ blockId: firstBlockId }).count();

    app.openSessionAdd(firstBlockId);
    app.sessionAdd.exerciseQuery = 'Forked exercise Z';
    app.sessionAdd.sets = 1;
    app.sessionAdd.reps = 5;
    await app.commitSessionAdd('fork');

    const workoutsAfter = await window.alfdb.workouts.count();
    const presOriginalAfter = await window.alfdb.prescriptions.where({ blockId: firstBlockId }).count();
    const session = await window.alfdb.sessions.get(app.activeSessionId);
    const newPerf = app.activeSessionPerformances.find(p => p.exerciseName === 'Forked exercise Z');
    const newWorkout = await window.alfdb.workouts.get(session.workoutId);
    const presInNewBlock = newPerf ? await window.alfdb.prescriptions.where({ blockId: newPerf.blockId }).count() : 0;
    const originalWorkout = await window.alfdb.workouts.get(originalWorkoutId);
    return {
      workoutsBefore, workoutsAfter,
      presOriginalBefore, presOriginalAfter,
      sessionWorkoutId: session.workoutId,
      originalIsCurrent: originalWorkout.isCurrent,
      newWorkoutIsCurrent: newWorkout.isCurrent,
      newWorkoutParentId: newWorkout.parentId,
      presInNewBlock,
      newPerf
    };
  }, { originalWorkoutId, firstBlockId });

  expect(result.workoutsAfter).toBe(result.workoutsBefore + 1);
  expect(result.presOriginalAfter).toBe(result.presOriginalBefore); // original block untouched
  expect(result.sessionWorkoutId).not.toBe(originalWorkoutId);
  expect(result.originalIsCurrent).toBe(0);
  expect(result.newWorkoutIsCurrent).toBe(1);
  expect(result.newWorkoutParentId).toBe(originalWorkoutId);
  expect(result.newPerf).toBeTruthy();
  expect(result.newPerf.prescriptionId).not.toBeNull();
});

test('remove exercise — session only: performance gone, prescription kept', async ({ page }) => {
  await startFirstSession(page);

  const result = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const target = app.activeSessionPerformances[0];
    const prescriptionId = target.prescriptionId;
    const presBefore = await window.alfdb.prescriptions.get(prescriptionId);

    app.openSessionRemove(target);
    await app.commitSessionRemove('session');

    const presAfter = await window.alfdb.prescriptions.get(prescriptionId);
    const stillThere = app.activeSessionPerformances.find(p => p.id === target.id);
    const setsLeft = await window.alfdb.sets.where({ performanceId: target.id }).count();
    return { presBefore: !!presBefore, presAfter: !!presAfter, stillThere, setsLeft };
  });

  expect(result.presBefore).toBe(true);
  expect(result.presAfter).toBe(true); // template kept
  expect(result.stillThere).toBeUndefined();
  expect(result.setsLeft).toBe(0);
});

test('remove exercise — template: prescription deleted too', async ({ page }) => {
  await startFirstSession(page);

  const result = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const target = app.activeSessionPerformances[0];
    const prescriptionId = target.prescriptionId;

    app.openSessionRemove(target);
    await app.commitSessionRemove('template');

    const presAfter = await window.alfdb.prescriptions.get(prescriptionId);
    return { presAfter: !!presAfter };
  });

  expect(result.presAfter).toBe(false);
});

test('remove exercise — fork: original prescription kept, fork copy deleted', async ({ page }) => {
  const { workoutId: originalWorkoutId } = await startFirstSession(page);

  const result = await page.evaluate(async (originalWorkoutId) => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const target = app.activeSessionPerformances[0];
    const originalPrescriptionId = target.prescriptionId;

    app.openSessionRemove(target);
    await app.commitSessionRemove('fork');

    const originalPres = await window.alfdb.prescriptions.get(originalPrescriptionId);
    const session = await window.alfdb.sessions.get(app.activeSessionId);
    const originalWorkout = await window.alfdb.workouts.get(originalWorkoutId);
    return {
      originalPresKept: !!originalPres,
      sessionPointsAway: session.workoutId !== originalWorkoutId,
      originalArchived: originalWorkout.isCurrent === 0
    };
  }, originalWorkoutId);

  expect(result.originalPresKept).toBe(true); // template untouched in original
  expect(result.sessionPointsAway).toBe(true);
  expect(result.originalArchived).toBe(true);
});

test('add block — session only: sentinel blockId, no Block row, then exercise added', async ({ page }) => {
  await startFirstSession(page);

  const result = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const blocksBefore = await window.alfdb.blocks.count();

    app.openSessionAddBlock();
    app.sessionAddBlock.name = 'Cooldown extras';
    app.sessionAddBlock.type = 'linear';
    await app.commitSessionAddBlock('session');

    const blocksAfter = await window.alfdb.blocks.count();
    const lockedScope = app.sessionAdd ? app.sessionAdd.lockedScope : null;
    const blockIdIsString = typeof (app.sessionAdd && app.sessionAdd.blockId) === 'string';

    app.sessionAdd.exerciseQuery = 'Adhoc finisher';
    app.sessionAdd.sets = 1;
    await app.commitSessionAdd('session');

    const newPerf = app.activeSessionPerformances.find(p => p.exerciseName === 'Adhoc finisher');
    const groups = app.sessionGroupedBlocks();
    const adhocGroup = groups.find(g => g.blockName === 'Cooldown extras');
    return { blocksBefore, blocksAfter, lockedScope, blockIdIsString, newPerf, adhocGroup };
  });

  expect(result.blocksAfter).toBe(result.blocksBefore); // no template Block row written
  expect(result.lockedScope).toBe('session');
  expect(result.blockIdIsString).toBe(true);
  expect(result.newPerf).toBeTruthy();
  expect(result.newPerf.prescriptionId).toBeNull();
  expect(typeof result.newPerf.blockId).toBe('string');
  expect(result.adhocGroup).toBeTruthy();
  expect(result.adhocGroup.blockName).toBe('Cooldown extras');
});

test('add block — template: real Block row added to current day', async ({ page }) => {
  const { dayId } = await startFirstSession(page);

  const result = await page.evaluate(async (dayId) => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const blocksBefore = await window.alfdb.blocks.where({ dayId }).count();

    app.openSessionAddBlock();
    app.sessionAddBlock.name = 'Extra accessory';
    app.sessionAddBlock.type = 'circuit';
    app.sessionAddBlock.rounds = 4;
    app.sessionAddBlock.restBetweenRoundsSec = 60;
    await app.commitSessionAddBlock('template');

    const blocksAfter = await window.alfdb.blocks.where({ dayId }).toArray();
    const newBlock = blocksAfter.find(b => b.name === 'Extra accessory');
    const sessionAddBlockId = app.sessionAdd ? app.sessionAdd.blockId : null;
    return {
      blocksBeforeCount: blocksBefore,
      blocksAfterCount: blocksAfter.length,
      newBlock,
      sessionAddBlockId,
      lockedScope: app.sessionAdd ? app.sessionAdd.lockedScope : null
    };
  }, dayId);

  expect(result.blocksAfterCount).toBe(result.blocksBeforeCount + 1);
  expect(result.newBlock).toBeTruthy();
  expect(result.newBlock.type).toBe('circuit');
  expect(result.newBlock.rounds).toBe(4);
  expect(result.newBlock.restBetweenRoundsSec).toBe(60);
  expect(result.sessionAddBlockId).toBe(result.newBlock.id);
  expect(result.lockedScope).toBe('template');
});

test('add block — fork: workout forked, block in fork, session re-pointed', async ({ page }) => {
  const { workoutId: originalWorkoutId } = await startFirstSession(page);

  const result = await page.evaluate(async (originalWorkoutId) => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const workoutsBefore = await window.alfdb.workouts.count();

    app.openSessionAddBlock();
    app.sessionAddBlock.name = 'Forked accessory';
    app.sessionAddBlock.type = 'linear';
    await app.commitSessionAddBlock('fork');

    const workoutsAfter = await window.alfdb.workouts.count();
    const session = await window.alfdb.sessions.get(app.activeSessionId);
    const newBlock = await window.alfdb.blocks.get(app.sessionAdd.blockId);
    const newBlockDay = await window.alfdb.days.get(newBlock.dayId);
    const originalWorkout = await window.alfdb.workouts.get(originalWorkoutId);
    return {
      workoutsBefore, workoutsAfter,
      sessionWorkoutId: session.workoutId,
      newBlockWorkoutId: newBlockDay.workoutId,
      originalIsCurrent: originalWorkout.isCurrent,
      lockedScope: app.sessionAdd.lockedScope
    };
  }, originalWorkoutId);

  expect(result.workoutsAfter).toBe(result.workoutsBefore + 1);
  expect(result.sessionWorkoutId).not.toBe(originalWorkoutId);
  expect(result.newBlockWorkoutId).toBe(result.sessionWorkoutId);
  expect(result.originalIsCurrent).toBe(0);
  expect(result.lockedScope).toBe('template');
});

test('add exercise inserts at end of its block group in performance ordering', async ({ page }) => {
  const { firstBlockId } = await startFirstSession(page);

  const result = await page.evaluate(async (firstBlockId) => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];

    app.openSessionAdd(firstBlockId);
    app.sessionAdd.exerciseQuery = 'Inserted in first block';
    app.sessionAdd.sets = 1;
    await app.commitSessionAdd('session');

    const inFirstBlock = app.activeSessionPerformances.filter(p => p.blockId === firstBlockId);
    const lastInBlock = inFirstBlock[inFirstBlock.length - 1];
    return { lastInBlockName: lastInBlock.exerciseName };
  }, firstBlockId);

  expect(result.lastInBlockName).toBe('Inserted in first block');
});
