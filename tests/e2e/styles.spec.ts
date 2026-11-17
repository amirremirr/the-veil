// UI V4 (V5): the style preview page at ?styles=1: three directions, the same two screens each, nothing
// applied to the game.
import { expect, test } from '@playwright/test';

test('the style preview shows three directions with the same two screens, and the game keeps its look', async ({ page }) => {
  await page.goto('/?styles=1');
  for (const name of ['A. Paper puppets', 'B. Retro TV studio', 'C. Clean editorial']) await expect(page.getByRole('heading', { name })).toBeVisible();
  await expect(page.locator('[data-style-frame]')).toHaveCount(6);
  for (const s of ['A', 'B', 'C']) await expect(page.locator(`[data-style-frame="${s}"]`)).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Buy cover this round?' })).toHaveCount(3);
  const d = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(d.sw).toBeLessThanOrEqual(d.cw);
  // The game itself never loads the preview.
  await page.goto('/');
  await page.waitForFunction(() => '__veil' in window);
  await expect(page.locator('[data-style-frame]')).toHaveCount(0);
});
