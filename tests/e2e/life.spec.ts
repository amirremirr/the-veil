// Play LIFE and Daily Life (RUNPLAN T6, T8): a whole life through the UI, every screen fits, ending on the
// result card with the rival line; Daily Life starts the shared seed of the Istanbul day.
import { expect, test, type Page } from '@playwright/test';

/** User review fix 1 and 2: no raw copy key ("play.x.y") on screen, and no stamp wider than its podium. */
async function cleanScreen(page: Page) {
  const text = await page.locator('body').innerText();
  expect(text, text.slice(0, 200)).not.toMatch(/\bplay\.[a-zA-Z]+/);
  const over = await page.evaluate(() =>
    [...document.querySelectorAll('[data-cast-stamp]')]
      .map((el) => {
        const pod = el.closest('[data-podium]') as HTMLElement | null;
        const r = el.getBoundingClientRect();
        return pod && r.width > pod.getBoundingClientRect().width + 1 ? `${el.textContent} ${Math.round(r.width)}>${Math.round(pod.getBoundingClientRect().width)}` : '';
      })
      .filter(Boolean),
  );
  expect(over).toEqual([]);
  // Fix 2: a stamp never covers its podium's name.
  const onName = await page.evaluate(() =>
    [...document.querySelectorAll('[data-cast-stamp]')]
      .map((el) => {
        const name = el.closest('[data-podium]')?.querySelector('[data-podium-name]');
        if (!name) return '';
        const a = el.getBoundingClientRect();
        const b = name.getBoundingClientRect();
        return a.bottom > b.top + 1 && a.top < b.bottom && a.right > b.left && a.left < b.right ? `${el.textContent} over ${name.textContent}` : '';
      })
      .filter(Boolean),
  );
  expect(onName).toEqual([]);
}


type Veil = { __veil: { getState(): { updateSettings(p: object): void; go(s: string): void; game: { mode: string; seed: string; phase: { kind: string } } | null } }; __autoplay(stop: (g: unknown) => boolean): string };

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate(() => localStorage.setItem('veil.play.opening.seen', '1'));
  await page.reload();
  await page.waitForFunction(() => '__veil' in window);
  await page.evaluate(() => (window as unknown as Veil).__veil.getState().updateSettings({ reducedMotion: true }));
});

test('Daily Life starts a life on the day seed and reaches the result card', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-360', 'One phone run is enough.');
  await page.evaluate(() => (window as unknown as Veil).__veil.getState().go('playMode'));
  await page.locator('[data-daily]').click();
  const g = await page.evaluate(() => (window as unknown as Veil).__veil.getState().game);
  expect(g?.mode).toBe('LIFE');
  expect(g?.seed).toMatch(/^daily-\d{4}-\d{2}-\d{2}$/);
  let ledgerSeen = false;
  for (let i = 0; i < 400; i++) {
    await page.waitForTimeout(30);
    const d = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ih: window.innerHeight }));
    expect(d.sw).toBeLessThanOrEqual(d.cw);
    expect(d.sh).toBeLessThanOrEqual(d.ih);
    await cleanScreen(page);
    if (await page.locator('[data-result-card]').count()) break;
    // G1: the first "See the money" link opens a ledger whose lines are listed, then closes.
    if (!ledgerSeen && (await page.locator('[data-ledger]').count())) {
      await page.locator('[data-ledger]').first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByRole('dialog')).toContainText('Living costs');
      await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click();
      ledgerSeen = true;
    }
    if (await page.locator('[data-beat-next]').count()) {
      await page.locator('[data-beat-next]').first().click();
      continue;
    }
    const kind = await page.evaluate(() => (window as unknown as Veil).__veil.getState().game?.phase.kind);
    if (kind === 'RUN_DEBRIEF' || kind === 'END') {
      expect(ledgerSeen).toBe(true);
      await page.getByRole('button', { name: /Skip|The missions flip/ }).click();
      continue;
    }
    await page.evaluate(() => {
      const w = window as unknown as Veil;
      const g0 = w.__veil.getState().game;
      w.__autoplay((g) => g !== g0);
    });
  }
  await expect(page.locator('[data-result-card]')).toBeVisible();
  await expect(page.getByText('Just for fun. Not a diagnosis.')).toBeVisible();
  await expect(page.locator('[data-rival]')).toContainText('Rematch with the same seed?');
});
