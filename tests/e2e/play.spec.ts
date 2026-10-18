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

async function startFullRun(page: Page, seed: string) {
  await page.getByRole('button', { name: 'Start a new life' }).click();
  await page.getByRole('button', { name: /Full game/ }).click();
  await page.getByLabel('Game code (optional)').fill(seed);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByText('This card is secret.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('heading', { name: 'Behind the Veil' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
}

test('starts a Full Run and plays the first Level 1 round through the UI', async ({ page }) => {
  await startFullRun(page, 'e2e-seed');
  // The briefing is a banner and the chat is a strip, so the first screen is the vote itself.
  await expect(page.getByRole('heading', { name: 'What others said' })).toBeVisible();
  await page.getByRole('button', { name: 'Reply' }).first().click();
  await page.getByRole('button', { name: 'My card is...' }).click();
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText('My card is Rawlsian.').locator('visible=true').first()).toBeVisible();
  await page.getByRole('button', { name: 'Back to my choice' }).click();
  await expect(page.getByText('My card is Rawlsian.').locator('visible=true').first()).toBeVisible();
  // Decide.
  await page.getByRole('button', { name: /Safety Net/ }).click();
  await page.getByRole('button', { name: 'Vote', exact: true }).click();
  // Results and the round summary are one screen.
  await expect(page.getByText('Winning rule', { exact: false }).first()).toBeVisible();
  await expect(page.getByText('Round 1 results', { exact: false })).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByText('Round 2 of 3')).toBeVisible();
  await noHorizontalScroll(page);
});

test('Level 1 Round 1 at 375 px: chat strip, unobstructed Vote, score breakdown', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 760 });
  await startFullRun(page, 'e2e-375');
  const strip = page.locator('section[aria-label="What others said"]');
  await expect(strip).toBeVisible();
  await expect(strip.getByRole('heading', { name: 'What others said' })).toBeVisible();
  const vote = page.getByRole('button', { name: 'Vote', exact: true });
  await expect(vote).toBeInViewport();
  // Every option card can be scrolled fully clear of the bottom bar.
  const bar = page.locator('[data-primary-bar]');
  for (const name of [/No Tax/, /Safety Net/, /Limit the Gap/, /Help the Poorest/]) {
    const card = page.getByRole('button', { name });
    // Try to scroll the card to sit just above the bar. If the page cannot scroll that far, it stays hidden.
    await card.evaluate((el) => {
      const bar = document.querySelector('[data-primary-bar]')!.getBoundingClientRect();
      window.scrollBy(0, el.getBoundingClientRect().bottom - bar.top + 8);
    });
    const c = (await card.boundingBox())!;
    const b = (await bar.boundingBox())!;
    expect(c.y + c.height).toBeLessThanOrEqual(b.y + 1);
  }
  await page.getByRole('button', { name: /Safety Net/ }).click();
  await vote.click();
  const breakdown = page.locator('[data-score-breakdown]');
  await expect(breakdown).toBeVisible();
  await expect(breakdown).toContainText('Your score:');
  // Whole numbers that add up, or the Egoist's single line.
  await expect(breakdown).toContainText(/= \d+ from your money \+ -?\d+ from your goal|all of it comes from your own money/);
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
