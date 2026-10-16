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
  await page.getByRole('button', { name: 'Begin Life' }).click();
  await page.getByRole('button', { name: /Full Run/ }).click();
  await page.getByLabel('Seed (optional)').fill('e2e-seed');
  await page.getByRole('button', { name: 'Submit Form 0-B' }).click();
  await expect(page.getByText('This card is private.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'I accept my values' }).click();
  await expect(page.getByRole('heading', { name: 'Behind the Veil' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  // Talk: send one message, then close the floor.
  await page.getByRole('button', { name: 'Claim values' }).click();
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('My Values card is Rawlsian.').locator('visible=true').first()).toBeVisible();
  await page.getByRole('button', { name: 'Close the floor' }).click();
  // Decide.
  await page.getByRole('button', { name: /The Safety Net/ }).click();
  await page.getByRole('button', { name: 'Submit Form 1-A' }).click();
  await expect(page.getByText('Adopted principle', { exact: false }).first()).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Incomes dealt' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Round 1 Ledger', { exact: false })).toBeVisible();
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
  await expect(page.getByText('Final Ruling of the Ministry of Deserving')).toBeVisible();
  await expect(page.getByText('Your Revealed Ideology', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download game log (JSON)' })).toBeVisible();
  await noHorizontalScroll(page);
});

test('the Archives search filters entries', async ({ page }) => {
  await page.getByRole('button', { name: 'The Archives' }).click();
  await page.getByLabel('Search the Archives').fill('lemons');
  await expect(page.getByRole('heading', { name: 'Adverse selection' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Maximin' })).toHaveCount(0);
});
