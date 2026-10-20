// Play mode, Episode 3, solo, through the real UI (PLAY_MODE_SPEC.md milestone P1): from the title to the
// episode summary, with no horizontal scroll on any screen.
import { expect, test, type Page } from '@playwright/test';

async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => '__veil' in window);
  await page.evaluate(() => (window as unknown as { __veil: { getState(): { updateSettings(p: object): void } } }).__veil.getState().updateSettings({ reducedMotion: true }));
});

test('plays Episode 3 from the title to the episode summary', async ({ page }) => {
  await page.getByRole('button', { name: 'Start a new life' }).click();
  await page.getByRole('button', { name: /Quick and fun/ }).click();
  await page.getByRole('button', { name: /Bad Luck Season/ }).click();
  await page.getByLabel('Show code (optional)').fill('e2e-play');
  await page.getByRole('button', { name: 'Go live' }).click();
  await expect(page.getByText('Your secret mission')).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Accept the mission' }).click();
  await expect(page.getByRole('heading', { name: 'Bad Luck Season' })).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Roll the cameras' }).click();
  for (let round = 1; round <= 3; round++) {
    await expect(page.getByText(`Round ${round} of 3`)).toBeVisible();
    await expect(page.getByText('SafeHands Mutual').first()).toBeVisible();
    await noHorizontalScroll(page);
    const buy = page.getByRole('button', { name: /Buy SafeHands cover/ });
    if (await buy.count()) await buy.click();
    await page.getByRole('button', { name: 'Lock it in' }).click();
    await expect(page.getByRole('heading', { name: 'Wheel of Misfortune' })).toBeVisible();
    await expect(page.locator('[data-host]').first()).toBeVisible();
    await noHorizontalScroll(page);
    await page.getByRole('button', { name: 'Continue' }).click();
    if (round === 2) {
      await expect(page.getByRole('heading', { name: 'The big vote' })).toBeVisible();
      await page.getByRole('button', { name: /Full cover for all/ }).click();
      await page.getByRole('button', { name: 'Cast my vote' }).click();
    }
  }
  await expect(page.getByRole('heading', { name: 'Guess a mission' })).toBeVisible();
  await noHorizontalScroll(page);
  await page.getByRole('button', { name: 'Get rich' }).click();
  await page.getByRole('button', { name: 'Lock in my guess' }).click();
  await expect(page.getByText('Episode summary')).toBeVisible();
  await page.getByRole('button', { name: 'What was really going on?' }).click();
  await expect(page.getByText("That's adverse selection.", { exact: false })).toBeVisible();
  await noHorizontalScroll(page);
});
