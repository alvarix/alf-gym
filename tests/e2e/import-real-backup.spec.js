// Diagnostic: import the real-world backup that's failing.
// See docs/20-debug-import.md.
// Run: npx playwright test import-real-backup.spec.js --reporter=list

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const BASE = 'http://localhost:8000';
const BACKUP_FILE = path.resolve(__dirname, '../../data/alfgym-backup-2026-05-14T18-30-13.json');

async function waitForAlpine(page) {
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data]');
    return el && el._x_dataStack;
  }, { timeout: 5000 });
}

test('import real backup file: capture per-store outcome', async ({ page }) => {
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto(BASE);
  await waitForAlpine(page);

  // Start from clean slate so the import is the only writer.
  await page.evaluate(async () => {
    const tables = ['workouts','days','blocks','exercises','prescriptions','sessions','performances','sets','painMarks','trackers','wishlist','meta'];
    await Promise.all(tables.map(t => window.alfdb[t].clear()));
  });

  const raw = fs.readFileSync(BACKUP_FILE, 'utf8');
  const parsed = JSON.parse(raw);

  // Drive applyBackupReplace directly to skip the confirm() dialog.
  const result = await page.evaluate(async (backup) => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    let err = null;
    try {
      await app.applyBackupReplace(backup);
    } catch (e) {
      err = { name: e.name, message: e.message, stack: e.stack };
    }
    const tables = ['workouts','days','blocks','exercises','prescriptions','sessions','performances','sets','painMarks','trackers','wishlist','meta'];
    const counts = {};
    for (const t of tables) counts[t] = (await window.alfdb[t].toArray()).length;
    return { err, counts };
  }, parsed);

  console.log('\n--- BROWSER CONSOLE ---');
  for (const l of logs) console.log(l);
  console.log('\n--- POST-IMPORT COUNTS ---');
  console.log(JSON.stringify(result.counts, null, 2));
  if (result.err) {
    console.log('\n--- IMPORT THREW ---');
    console.log(result.err.name + ': ' + result.err.message);
    console.log(result.err.stack);
  }

  const expected = {};
  for (const [name, rows] of Object.entries(parsed.stores)) expected[name] = rows.length;
  console.log('\n--- EXPECTED COUNTS ---');
  console.log(JSON.stringify(expected, null, 2));

  // Soft assertion — we want to see the diagnostic, not gate the run.
  expect(result.err, 'applyBackupReplace threw').toBeNull();
  expect(result.counts.sessions, 'sessions written').toBe(expected.sessions);
});

test('full confirmImport flow over seeded DB — UI sees sessions', async ({ page }) => {
  const logs = [];
  page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));

  await page.goto(BASE);
  await waitForAlpine(page);
  // Don't wipe — let the seeded DB stand in for the user's real starting state.

  // Auto-accept the two confirm() dialogs that confirmImport uses.
  page.on('dialog', async d => { await d.accept(); });

  const raw = fs.readFileSync(BACKUP_FILE, 'utf8');

  const result = await page.evaluate(async (text) => {
    const app = document.querySelector('[x-data]')._x_dataStack[0];
    app.importText = text;
    app.stageImport();
    const stageError = app.importError;
    const stageCounts = app.importPreview ? app.importPreview.counts : null;

    let confirmErr = null;
    try {
      await app.confirmImport();
    } catch (e) {
      confirmErr = { name: e.name, message: e.message, stack: e.stack };
    }

    const tables = ['workouts','days','blocks','exercises','prescriptions','sessions','performances','sets','painMarks','trackers','wishlist','meta'];
    const idbCounts = {};
    for (const t of tables) idbCounts[t] = (await window.alfdb[t].toArray()).length;

    return {
      stageError,
      stageCounts,
      confirmErr,
      importError: app.importError,
      uiSessionsLen: app.sessions.length,
      idbCounts,
      hasUndo: app.hasUndo,
      stashSize: (localStorage.getItem('alfgym.lastBackup') || '').length
    };
  }, raw);

  console.log('\n--- BROWSER CONSOLE ---');
  for (const l of logs) console.log(l);
  console.log('\n--- RESULT ---');
  console.log(JSON.stringify(result, null, 2));

  expect(result.confirmErr, 'confirmImport threw').toBeNull();
  expect(result.importError, 'app.importError').toBe('');
  expect(result.idbCounts.sessions).toBe(3);
  expect(result.uiSessionsLen, 'UI sessions array populated').toBe(3);
});
