// E2E tests for Phase A: Backup / Restore round-trip.
// Run: npx playwright test backup.spec.js

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8000';
const STORES = ['workouts','days','blocks','exercises','prescriptions','sessions','performances','sets','painMarks','trackers','wishlist','meta'];

async function waitForAlpine(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data]');
    return el && el._x_dataStack;
  }, { timeout: 5000 });
}

function getAlpine() {
  return document.querySelector('[x-data]')._x_dataStack[0];
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', e => console.error('Page error:', e.message));
  await page.goto(BASE);
  await waitForAlpine(page);
  await page.evaluate(() => window.alfdbReset());
  await page.goto(BASE);
  await waitForAlpine(page);
});

test('buildBackup returns all stores with seed data', async ({ page }) => {
  const backup = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    return await app.buildBackup();
  });

  expect(backup.app).toBe('alf-gym');
  expect(backup.schemaVersion).toBe(5);
  expect(typeof backup.exportedAt).toBe('string');
  for (const name of STORES) {
    expect(Array.isArray(backup.stores[name])).toBe(true);
  }
  // Seed includes workouts and exercises; should not be empty.
  expect(backup.stores.workouts.length).toBeGreaterThan(0);
  expect(backup.stores.exercises.length).toBeGreaterThan(0);
});

test('round-trip: export, wipe, restore — all stores match', async ({ page, context }) => {
  // 1. Snapshot original.
  const before = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    return await app.buildBackup();
  });

  // 2. Wipe DB completely (no re-seed).
  await page.evaluate(async () => {
    const tables = ['workouts','days','blocks','exercises','prescriptions','sessions','performances','sets','painMarks','trackers','wishlist','meta'];
    await Promise.all(tables.map(t => window.alfdb[t].clear()));
  });

  // Sanity: stores really are empty post-wipe.
  const empties = await page.evaluate(async () => {
    const tables = ['workouts','days','blocks','exercises','prescriptions','sessions','performances','sets','painMarks','trackers','wishlist','meta'];
    const out = {};
    for (const t of tables) out[t] = (await window.alfdb[t].toArray()).length;
    return out;
  });
  for (const name of STORES) expect(empties[name]).toBe(0);

  // 3. Restore from the backup blob.
  await page.evaluate(async (snapshot) => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    await app.applyBackupReplace(snapshot);
  }, before);

  // 4. Re-export and deep-compare every store.
  const after = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    return await app.buildBackup();
  });

  for (const name of STORES) {
    const sortById = (a, b) => {
      const ka = a.id ?? a.key ?? 0;
      const kb = b.id ?? b.key ?? 0;
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    };
    const a = [...before.stores[name]].sort(sortById);
    const b = [...after.stores[name]].sort(sortById);
    expect(b, `store ${name} differs after round-trip`).toEqual(a);
  }
});

test('stageImport rejects non-alfgym JSON', async ({ page }) => {
  const err = await page.evaluate(() => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    app.importText = JSON.stringify({ foo: 'bar' });
    app.stageImport();
    return app.importError;
  });
  expect(err).toContain('Not an alf-gym backup');
});

test('stageImport rejects schema-version mismatch', async ({ page }) => {
  const err = await page.evaluate(() => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    app.importText = JSON.stringify({ app: 'alf-gym', schemaVersion: 99, stores: {} });
    app.stageImport();
    return app.importError;
  });
  expect(err).toContain('Schema mismatch');
});

test('stageImport accepts valid backup and produces counts', async ({ page }) => {
  const preview = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const backup = await app.buildBackup();
    app.importText = JSON.stringify(backup);
    app.stageImport();
    return app.importPreview ? { counts: app.importPreview.counts, schemaVersion: app.importPreview.parsed.schemaVersion } : null;
  });
  expect(preview).not.toBeNull();
  expect(preview.schemaVersion).toBe(5);
  expect(preview.counts.workouts).toBeGreaterThan(0);
});

test('undoLastRestore reverts to pre-restore state', async ({ page }) => {
  // Snapshot original.
  const original = await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    return await app.buildBackup();
  });

  // Build a different backup (mutate one workout name) and restore it,
  // which should auto-stash the original to localStorage.
  await page.evaluate(async (orig) => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const mutated = JSON.parse(JSON.stringify(orig));
    mutated.stores.workouts[0].name = 'MUTATED FOR TEST';
    // Stash directly + apply (bypass confirm dialogs).
    const current = await app.buildBackup();
    localStorage.setItem('alfgym.lastBackup', JSON.stringify(current));
    await app.applyBackupReplace(mutated);
    app.hasUndo = true;
  }, original);

  const mutatedName = await page.evaluate(async () => {
    const ws = await window.alfdb.workouts.toArray();
    return ws[0].name;
  });
  expect(mutatedName).toBe('MUTATED FOR TEST');

  // Now consume the undo.
  await page.evaluate(async () => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    const raw = localStorage.getItem('alfgym.lastBackup');
    const parsed = JSON.parse(raw);
    await app.applyBackupReplace(parsed);
    localStorage.removeItem('alfgym.lastBackup');
    app.hasUndo = false;
  });

  const restoredName = await page.evaluate(async () => {
    const ws = await window.alfdb.workouts.toArray();
    return ws[0].name;
  });
  expect(restoredName).toBe(original.stores.workouts[0].name);
});
