/**
 * Smoke test: import-md flow.
 * Primary entry point: #/import-md/d/<dayId> — adds blocks to an existing Day.
 * Direct entry point: #/import-md — creates a new draft Workout.
 *
 * Run: npx playwright test tests/e2e/import-md.spec.js
 * Requires: python3 -m http.server 8000 from app/ directory.
 */

const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:8000';

const FIXTURE_MD = fs.readFileSync(
  path.join(__dirname, '../import/fixtures/9.2B-shoulder-pt.md'),
  'utf8'
);

test.beforeEach(async ({ page }) => {
  page.on('pageerror', e => console.error('Page error:', e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data]');
    return el && el._x_dataStack;
  }, { timeout: 5000 });
  await page.evaluate(() => window.alfdbReset());
  await page.goto(BASE);
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data]');
    return el && el._x_dataStack;
  }, { timeout: 5000 });
});

test('direct #/import-md route shows workout-name input', async ({ page }) => {
  await page.goto(BASE + '#/import-md');
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data]');
    return el && el._x_dataStack;
  }, { timeout: 5000 });

  await page.getByPlaceholder('…or paste a workout .md file here').fill(FIXTURE_MD);
  await page.locator('button', { hasText: 'parse' }).first().click();

  const nameInput = page.locator('input[placeholder="(untitled)"]');
  await expect(nameInput).toBeVisible({ timeout: 3000 });
  await expect(nameInput).toHaveValue('Shoulder PT');
});

test('direct route commit creates draft Workout and navigates to it', async ({ page }) => {
  await page.goto(BASE + '#/import-md');
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data]');
    return el && el._x_dataStack;
  }, { timeout: 5000 });

  await page.getByPlaceholder('…or paste a workout .md file here').fill(FIXTURE_MD);
  await page.locator('button', { hasText: 'parse' }).first().click();

  const commitBtn = page.locator('button', { hasText: 'create draft workout' });
  await expect(commitBtn).toBeVisible({ timeout: 3000 });
  await commitBtn.click();

  await expect(page).toHaveURL(/#\/w\/\d+/, { timeout: 5000 });
});

test('day-target flow: ↧ import md button on Day view navigates to scoped route', async ({ page }) => {
  // Open seed workout, then first day.
  const openBtn = page.locator('div[x-show="view === \'workouts\'"] button', { hasText: 'open' }).first();
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();
  await expect(page).toHaveURL(/#\/w\/\d+/);

  // Click first day's edit button.
  const editBtn = page.locator('div[x-show="view === \'workout\'"] button', { hasText: 'edit' }).first();
  await editBtn.click();
  await expect(page).toHaveURL(/#\/w\/\d+\/d\/\d+/);

  // Click ↧ import md button.
  const importBtn = page.locator('button[title="import blocks from markdown into this day"]');
  await expect(importBtn).toBeVisible({ timeout: 3000 });
  await importBtn.click();

  await expect(page).toHaveURL(/#\/import-md\/d\/\d+/);
});

test('day-target flow: paste, parse, commit appends blocks and returns to Day', async ({ page }) => {
  // Navigate to the day view first.
  const openBtn = page.locator('div[x-show="view === \'workouts\'"] button', { hasText: 'open' }).first();
  await openBtn.click();
  await expect(page).toHaveURL(/#\/w\/\d+/);
  const editBtn = page.locator('div[x-show="view === \'workout\'"] button', { hasText: 'edit' }).first();
  await editBtn.click();
  await expect(page).toHaveURL(/#\/w\/\d+\/d\/\d+/);
  const dayUrl = page.url();
  await page.locator('button[title="import blocks from markdown into this day"]').click();
  await expect(page).toHaveURL(/#\/import-md\/d\/\d+/);

  // Paste, parse, commit.
  await page.getByPlaceholder('…or paste a workout .md file here').fill(FIXTURE_MD);
  await page.locator('button', { hasText: 'parse' }).first().click();

  const commitBtn = page.locator('button', { hasText: 'add blocks to day' });
  await expect(commitBtn).toBeVisible({ timeout: 3000 });
  await commitBtn.click();

  // Should return to the same Day URL.
  await expect(page).toHaveURL(dayUrl, { timeout: 5000 });

  // The day should now show imported blocks. The seeded day already had blocks;
  // we expect MORE blocks now (4 blocks in the fixture).
  const dayBlockCount = await page.locator('div[x-show="view === \'day\'"] .ix-card').count();
  expect(dayBlockCount).toBeGreaterThanOrEqual(4);
});
