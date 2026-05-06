// E2E tests for session capture flow.
// Run: npx playwright test
// Requires: python3 -m http.server 8000 running from app/ directory (or use webServer below).

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:8000';

test.beforeEach(async ({ page }) => {
  page.on('pageerror', e => console.error('Page error:', e.message));

  // Load app, wait for Alpine to mount, reset DB, then reload so Alpine
  // picks up the fresh seed data from scratch.
  await page.goto(BASE);
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data]');
    return el && el._x_dataStack;
  }, { timeout: 5000 });
  await page.evaluate(() => window.alfdbReset());
  // Reload after reset so Alpine initialises against the new seed.
  await page.goto(BASE);
  await page.waitForFunction(() => {
    const el = document.querySelector('[x-data]');
    return el && el._x_dataStack;
  }, { timeout: 5000 });
});

async function goToWorkout92(page) {
  // The workout list renders cards in a x-for template.
  // Click the 'open' button on the Workout 9.2 card (not the JSON debug panel).
  const openBtn = page.locator('div[x-show="view === \'workouts\'"] button', { hasText: 'open' }).first();
  await expect(openBtn).toBeVisible({ timeout: 5000 });
  await openBtn.click();
  await expect(page).toHaveURL(/\#\/w\/\d+/);
}

test('start session button present on workout view', async ({ page }) => {
  await goToWorkout92(page);

  // Each day card should have a ▶ start session button.
  const startButtons = page.locator('button[title="start session"]');
  await expect(startButtons.first()).toBeVisible({ timeout: 3000 });
  const count = await startButtons.count();
  expect(count).toBeGreaterThan(0);
});

test('start session navigates to capture view', async ({ page }) => {
  await goToWorkout92(page);

  // Click the ▶ button on the first day.
  await page.locator('button[title="start session"]').first().click();

  // Should land on the session capture view.
  await expect(page).toHaveURL(/\#\/s\/\d+/, { timeout: 5000 });

  // Session view should have a visible 'end session' button.
  await expect(page.getByRole('button', { name: 'end session' }).first()).toBeVisible({ timeout: 3000 });
});

test('set rows render in en mode', async ({ page }) => {
  await goToWorkout92(page);
  await page.locator('button[title="start session"]').first().click();
  await expect(page).toHaveURL(/\#\/s\/\d+/, { timeout: 5000 });

  // In en mode: reps column header visible, token column hidden.
  await expect(page.locator('th', { hasText: 'reps' }).first()).toBeVisible({ timeout: 3000 });
  await expect(page.locator('th', { hasText: 'token' }).first()).toBeHidden();
});

test('no JS errors on app load', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.reload();
  await page.waitForTimeout(500);
  expect(errors).toHaveLength(0);
});
