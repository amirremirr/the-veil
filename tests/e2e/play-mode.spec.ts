// Play mode, Episode 3, solo, through the real UI (PLAY_MODE_SPEC.md milestone P1, redesign D-108): from
// the title to the episode summary, tapping through every beat. No screen may scroll, sideways or down.
import { expect, test, type Page } from '@playwright/test';

async function fits(page: Page) {
  const d = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ih: window.innerHeight }));
  expect(d.sw).toBeLessThanOrEqual(d.cw);
  // Only phones get the one-screen rule; desktop windows are taller anyway.
  if (d.cw < 768) expect(d.sh).toBeLessThanOrEqual(d.ih);
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
  await fits(page);
  await page.getByRole('button', { name: 'Accept the mission' }).click();
  await expect(page.getByRole('heading', { name: 'Bad Luck Season' })).toBeVisible();
  await fits(page);
  await page.getByRole('button', { name: 'Roll the cameras' }).click();
  let wheels = 0;
  let prices = 0;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(50);
    await fits(page);
    if (await page.getByText('Episode summary').count()) break;
    if (await page.locator('[data-beat-next]').count()) {
      if (await page.locator('[data-outcome]').count()) wheels++;
      await page.locator('[data-beat-next]').click();
    } else if (await page.getByRole('button', { name: 'Lock it in' }).count()) {
      await expect(page.getByText('Your chance of disaster')).toBeVisible();
      const buy = page.getByRole('button', { name: /Buy cover/ });
      if (await buy.count()) await buy.click();
      await page.getByRole('button', { name: 'Lock it in' }).click();
    } else if (await page.getByRole('button', { name: 'Cast my vote' }).count()) {
      await page.getByRole('button', { name: /Full cover for all/ }).click();
      await page.getByRole('button', { name: 'Cast my vote' }).click();
    } else if (await page.locator('[data-price]').count()) {
      prices++;
      await page.getByRole('button', { name: /^(Round \d|To the vote)$/ }).click();
    } else if (await page.locator('[data-outcome]').count()) {
      wheels++;
      await page.getByRole('button', { name: 'Tap to continue' }).click();
    } else if (await page.getByRole('heading', { name: 'Guess a mission' }).count()) {
      await page.getByRole('button', { name: 'Get rich' }).click();
      await page.getByRole('button', { name: 'Lock in my guess' }).click();
    } else throw new Error(`unknown screen: ${(await page.locator('body').innerText()).slice(0, 200)}`);
  }
  expect(wheels).toBe(3);
  expect(prices).toBeGreaterThanOrEqual(1);
  await expect(page.getByText('Episode summary')).toBeVisible();
  await page.getByRole('button', { name: 'What was really going on?' }).click();
  await expect(page.getByText("That's adverse selection.", { exact: false })).toBeVisible();
});
