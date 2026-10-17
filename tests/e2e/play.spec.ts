import { expect, test, type Page } from '@playwright/test';

async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test('starts a Full Run and plays the first Level 1 round through the UI', async ({ page }) => {
  await page.getByRole('button', { name: 'Start a new life' }).click();
  await page.getByRole('button', { name: /Full game/ }).click();
  await page.getByLabel('Game code (optional)').fill('e2e-seed');
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('This card is secret.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('heading', { name: 'Behind the Veil' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  // Talk: send one message, then close the floor.
  await page.getByRole('button', { name: 'My card is...' }).click();
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('My card is Rawlsian.').locator('visible=true').first()).toBeVisible();
  await page.getByRole('button', { name: 'Done chatting' }).click();
  // Decide.
  await page.getByRole('button', { name: /Safety Net/ }).click();
  await page.getByRole('button', { name: 'Vote', exact: true }).click();
  await expect(page.getByText('Winning rule', { exact: false }).first()).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Incomes' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Round 1 results', { exact: false })).toBeVisible();
  await noHorizontalScroll(page);
});

test('a scripted full run reaches the final ruling with every card revealed', async ({ page }) => {
  await page.waitForFunction(() => '__autoplay' in window);
  await page.evaluate(() => {
    const w = window as unknown as {
      __veil: { getState(): { start(c: object): void } };
      __autoplay(stop: (g: { phase: { kind: string } }) => boolean): string;
    };
    w.__veil.getState().start({ mode: 'FULL_RUN', nPlayers: 4, difficulty: 'NORMAL', seed: 'e2e-full' });
    w.__autoplay((g) => g.phase.kind === 'RUN_DEBRIEF');
  });
  await expect(page.getByText('Final results')).toBeVisible();
  await expect(page.getByText('What your choices say about you', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download game record (JSON)' })).toBeVisible();
  await noHorizontalScroll(page);
});

test('the Archives search filters entries', async ({ page }) => {
  await page.getByRole('button', { name: 'Glossary' }).click();
  await page.getByLabel('Search').fill('lemons');
  await expect(page.getByRole('heading', { name: 'Adverse selection' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Maximin' })).toHaveCount(0);
});
