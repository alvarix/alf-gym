// E2E tests for Phase C: edit prescriptions and blocks mid-session with
// three-way scope: session-only / template / fork.
// Run: npx playwright test edit-in-session.spec.js

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

async function startFirstSession(page) {
  return await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const days = await window.alfdb.days.toArray();
    const day = days.sort((a, b) => a.order - b.order)[0];
    await app.startSessionForDay(day.id);
    while (!app.activeSession || !app.activeSessionPerformances.length)
      await new Promise(r => setTimeout(r, 30));
    return {
      sessionId: app.activeSessionId,
      workoutId: app.activeSession.workoutId,
      dayId: day.id,
      firstBlockId: app.activeSessionPerformances[0].blockId
    };
  });
}

test('edit prescription — session only: Performance updated, Prescription row untouched', async ({ page }) => {
  await startFirstSession(page);

  const result = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const perf = app.activeSessionPerformances[0];
    const originalPrescriptionId = perf.prescriptionId;
    const presBefore = await window.alfdb.prescriptions.get(originalPrescriptionId);

    app.openEditPerf(perf);
    app.sessionEditPerf.fields.sets = 9;
    app.sessionEditPerf.fields.load = '99kg';
    await app.commitEditPerf('session');

    const presAfter = await window.alfdb.prescriptions.get(originalPrescriptionId);
    const updatedPerf = app.activeSessionPerformances.find(p => p.id === perf.id);
    return {
      originalSets: presBefore.sets,
      prescriptionSetsAfter: presAfter.sets,
      perfSetsAfter: updatedPerf.prescribedSets,
      perfLoadAfter: updatedPerf.prescribedLoad
    };
  });

  expect(result.prescriptionSetsAfter).toBe(result.originalSets); // template untouched
  expect(result.perfSetsAfter).toBe(9); // performance updated
  expect(result.perfLoadAfter).toBe('99kg');
});

test('edit prescription — template: Prescription and Performance both updated', async ({ page }) => {
  await startFirstSession(page);

  const result = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const perf = app.activeSessionPerformances[0];
    const prescriptionId = perf.prescriptionId;

    app.openEditPerf(perf);
    app.sessionEditPerf.fields.sets = 7;
    app.sessionEditPerf.fields.reps = '12';
    await app.commitEditPerf('template');

    const presAfter = await window.alfdb.prescriptions.get(prescriptionId);
    const updatedPerf = app.activeSessionPerformances.find(p => p.id === perf.id);
    return {
      prescriptionSets: presAfter.sets,
      prescriptionReps: presAfter.reps,
      perfSets: updatedPerf.prescribedSets,
      perfReps: updatedPerf.prescribedReps
    };
  });

  expect(result.prescriptionSets).toBe(7);
  expect(result.prescriptionReps).toBe('12');
  expect(result.perfSets).toBe(7);
  expect(result.perfReps).toBe('12');
});

test('edit prescription — fork: new workout, original Prescription untouched, fork Prescription edited', async ({ page }) => {
  const { workoutId: originalWorkoutId } = await startFirstSession(page);

  const result = await page.evaluate(async (originalWorkoutId) => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const perf = app.activeSessionPerformances[0];
    const originalPrescriptionId = perf.prescriptionId;
    const workoutsBefore = await window.alfdb.workouts.count();

    app.openEditPerf(perf);
    app.sessionEditPerf.fields.sets = 4;
    app.sessionEditPerf.fields.load = 'forked-load';
    await app.commitEditPerf('fork');

    const workoutsAfter = await window.alfdb.workouts.count();
    const originalPres = await window.alfdb.prescriptions.get(originalPrescriptionId);
    const session = await window.alfdb.sessions.get(app.activeSessionId);
    const updatedPerf = app.activeSessionPerformances.find(p => p.id === perf.id);
    const forkPres = updatedPerf.prescriptionId !== originalPrescriptionId
      ? await window.alfdb.prescriptions.get(updatedPerf.prescriptionId) : null;
    const originalWorkout = await window.alfdb.workouts.get(originalWorkoutId);

    return {
      workoutsBefore, workoutsAfter,
      originalPresSets: originalPres.sets,
      sessionWorkoutId: session.workoutId,
      originalIsCurrent: originalWorkout.isCurrent,
      perfSets: updatedPerf.prescribedSets,
      forkPresSets: forkPres ? forkPres.sets : null,
      forkPresLoad: forkPres ? forkPres.load : null
    };
  }, originalWorkoutId);

  expect(result.workoutsAfter).toBe(result.workoutsBefore + 1);
  expect(result.originalPresSets).not.toBe(4); // original untouched
  expect(result.sessionWorkoutId).not.toBe(originalWorkoutId);
  expect(result.originalIsCurrent).toBe(0);
  expect(result.perfSets).toBe(4);
  expect(result.forkPresSets).toBe(4);
  expect(result.forkPresLoad).toBe('forked-load');
});

test('edit prescription — exercise swap: Performance exerciseName and exerciseId update', async ({ page }) => {
  await startFirstSession(page);

  const result = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const perf = app.activeSessionPerformances[0];
    const originalExerciseId = perf.exerciseId;
    const exercisesBefore = await window.alfdb.exercises.count();

    app.openEditPerf(perf);
    app.sessionEditPerf.fields.exerciseQuery = 'Totally new exercise ABC';
    await app.commitEditPerf('session');

    const exercisesAfter = await window.alfdb.exercises.count();
    const updatedPerf = app.activeSessionPerformances.find(p => p.id === perf.id);
    return {
      originalExerciseId,
      newExerciseId: updatedPerf.exerciseId,
      newExerciseName: updatedPerf.exerciseName,
      exercisesGrew: exercisesAfter > exercisesBefore
    };
  });

  expect(result.newExerciseId).not.toBe(result.originalExerciseId);
  expect(result.newExerciseName).toBe('Totally new exercise ABC');
  expect(result.exercisesGrew).toBe(true);
});

test('edit prescription — session-only perf (prescriptionId null): locked to session scope', async ({ page }) => {
  await startFirstSession(page);

  const result = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const firstBlockId = app.activeSessionPerformances[0].blockId;

    // Add a session-only exercise.
    app.openSessionAdd(firstBlockId);
    app.sessionAdd.exerciseQuery = 'Session only exercise';
    app.sessionAdd.sets = 2;
    await app.commitSessionAdd('session');

    const sessionOnlyPerf = app.activeSessionPerformances.find(p => p.exerciseName === 'Session only exercise');
    const workoutsBefore = await window.alfdb.workouts.count();

    // Try to edit with 'fork' — should be clamped to 'session'.
    app.openEditPerf(sessionOnlyPerf);
    app.sessionEditPerf.fields.sets = 5;
    await app.commitEditPerf('fork'); // should be forced to session

    const workoutsAfter = await window.alfdb.workouts.count();
    const updatedPerf = app.activeSessionPerformances.find(p => p.id === sessionOnlyPerf.id);
    return {
      prescriptionIdNull: updatedPerf.prescriptionId == null,
      setsUpdated: updatedPerf.prescribedSets === 5,
      noForkCreated: workoutsAfter === workoutsBefore
    };
  });

  expect(result.prescriptionIdNull).toBe(true);
  expect(result.setsUpdated).toBe(true);
  expect(result.noForkCreated).toBe(true);
});

test('edit block — session only: Block row untouched, all matching Performance rows updated', async ({ page }) => {
  await startFirstSession(page);

  const result = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const groups = app.sessionGroupedBlocks();
    const g = groups[0];
    const blockId = g.blockId;
    const blockBefore = await window.alfdb.blocks.get(blockId);

    app.openEditBlock(g);
    app.sessionEditBlock.fields.name = 'Renamed session only';
    await app.commitEditBlock('session');

    const blockAfter = await window.alfdb.blocks.get(blockId);
    const perfsInBlock = app.activeSessionPerformances.filter(p => p.blockId === blockId);
    return {
      blockNameBefore: blockBefore.name,
      blockNameAfter: blockAfter.name,
      allPerfsUpdated: perfsInBlock.every(p => p.blockName === 'Renamed session only')
    };
  });

  expect(result.blockNameBefore).toBe(result.blockNameAfter); // Block row untouched
  expect(result.allPerfsUpdated).toBe(true);
});

test('edit block — template: Block row updated, all matching Performance rows updated', async ({ page }) => {
  await startFirstSession(page);

  const result = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const groups = app.sessionGroupedBlocks();
    const g = groups[0];
    const blockId = g.blockId;

    app.openEditBlock(g);
    app.sessionEditBlock.fields.name = 'Renamed to template';
    await app.commitEditBlock('template');

    const blockAfter = await window.alfdb.blocks.get(blockId);
    const perfsInBlock = app.activeSessionPerformances.filter(p => p.blockId === blockId);
    return {
      blockNameAfter: blockAfter.name,
      allPerfsUpdated: perfsInBlock.every(p => p.blockName === 'Renamed to template')
    };
  });

  expect(result.blockNameAfter).toBe('Renamed to template');
  expect(result.allPerfsUpdated).toBe(true);
});

test('edit block — fork: new workout, original Block untouched, fork Block edited', async ({ page }) => {
  const { workoutId: originalWorkoutId } = await startFirstSession(page);

  const result = await page.evaluate(async (originalWorkoutId) => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const groups = app.sessionGroupedBlocks();
    const g = groups[0];
    const originalBlockId = g.blockId;
    const blockBefore = await window.alfdb.blocks.get(originalBlockId);
    const workoutsBefore = await window.alfdb.workouts.count();

    app.openEditBlock(g);
    app.sessionEditBlock.fields.name = 'Renamed via fork';
    await app.commitEditBlock('fork');

    const workoutsAfter = await window.alfdb.workouts.count();
    const originalBlock = await window.alfdb.blocks.get(originalBlockId);
    const originalWorkout = await window.alfdb.workouts.get(originalWorkoutId);
    const session = await window.alfdb.sessions.get(app.activeSessionId);
    const updatedGroups = app.sessionGroupedBlocks();
    const updatedG = updatedGroups[0];

    return {
      workoutsBefore, workoutsAfter,
      originalBlockName: originalBlock.name,
      originalIsCurrent: originalWorkout.isCurrent,
      sessionWorkoutId: session.workoutId,
      renamedPerfsUpdated: updatedG.performances.every(p => p.blockName === 'Renamed via fork')
    };
  }, originalWorkoutId);

  expect(result.workoutsAfter).toBe(result.workoutsBefore + 1);
  expect(result.originalBlockName).not.toBe('Renamed via fork');
  expect(result.originalIsCurrent).toBe(0);
  expect(result.sessionWorkoutId).not.toBe(originalWorkoutId);
  expect(result.renamedPerfsUpdated).toBe(true);
});

test('edit block — sentinel session-only block: locked to session scope, no fork created', async ({ page }) => {
  await startFirstSession(page);

  const result = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const workoutsBefore = await window.alfdb.workouts.count();

    // Create a session-only block.
    app.openSessionAddBlock();
    app.sessionAddBlock.name = 'Session block';
    app.sessionAddBlock.type = 'linear';
    await app.commitSessionAddBlock('session');

    app.sessionAdd.exerciseQuery = 'Sentinel exercise';
    app.sessionAdd.sets = 1;
    await app.commitSessionAdd('session');

    const groups = app.sessionGroupedBlocks();
    const sentinelGroup = groups.find(g => g.blockName === 'Session block');
    const sentinelBlockId = sentinelGroup.blockId;
    const isString = typeof sentinelBlockId === 'string';

    // Try to edit with 'fork' — should be clamped to 'session'.
    app.openEditBlock(sentinelGroup);
    app.sessionEditBlock.fields.name = 'Session block renamed';
    await app.commitEditBlock('fork');

    const workoutsAfter = await window.alfdb.workouts.count();
    const updatedGroups = app.sessionGroupedBlocks();
    const updatedG = updatedGroups.find(g => g.blockId === sentinelBlockId);
    return {
      isString,
      noForkCreated: workoutsAfter === workoutsBefore,
      perfsRenamed: updatedG ? updatedG.performances.every(p => p.blockName === 'Session block renamed') : false
    };
  });

  expect(result.isString).toBe(true);
  expect(result.noForkCreated).toBe(true);
  expect(result.perfsRenamed).toBe(true);
});

test('edit block — type change linear to circuit: rounds and restBetweenRoundsSec written', async ({ page }) => {
  await startFirstSession(page);

  const result = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const groups = app.sessionGroupedBlocks();
    const g = groups.find(g => g.blockType === 'linear');
    const blockId = g.blockId;

    app.openEditBlock(g);
    app.sessionEditBlock.fields.type = 'circuit';
    app.sessionEditBlock.fields.rounds = 5;
    app.sessionEditBlock.fields.restBetweenRoundsSec = 45;
    await app.commitEditBlock('template');

    const blockAfter = await window.alfdb.blocks.get(blockId);
    const perfsInBlock = app.activeSessionPerformances.filter(p => p.blockId === blockId);
    return {
      blockType: blockAfter.type,
      blockRounds: blockAfter.rounds,
      blockRest: blockAfter.restBetweenRoundsSec,
      perfsUpdated: perfsInBlock.every(p => p.blockType === 'circuit' && p.blockRounds === 5 && p.blockRestBetweenRoundsSec === 45)
    };
  });

  expect(result.blockType).toBe('circuit');
  expect(result.blockRounds).toBe(5);
  expect(result.blockRest).toBe(45);
  expect(result.perfsUpdated).toBe(true);
});
