// Play mode, Episode 3 (The Pool, PLAY_V2_SPEC.md Q1), solo, through the real UI: from the title to the
// episode summary, tapping through every beat. No screen may scroll, sideways or down.
import { expect, test, type Page } from '@playwright/test';

/** User review fix 1 and 2: no raw copy key ("play.x.y") on screen, and no stamp wider than its podium. */
export async function cleanScreen(page: Page) {
  const text = await page.locator('body').innerText();
  expect(text, text.slice(0, 200)).not.toMatch(/\bplay\.[a-zA-Z]+/);
  // V5: no unfilled {placeholder} on screen either.
  expect(text, text.slice(0, 200)).not.toMatch(/\{[a-zA-Z]+\}/);
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

async function fits(page: Page) {
  await cleanScreen(page);
  const d = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, sh: document.documentElement.scrollHeight, ih: window.innerHeight }));
  expect(d.sw).toBeLessThanOrEqual(d.cw);
  // Only phones get the one-screen rule; desktop windows are taller anyway.
  if (d.cw < 768) expect(d.sh, (await page.locator('body').innerText()).slice(0, 300)).toBeLessThanOrEqual(d.ih);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.waitForFunction(() => '__veil' in window);
  await page.evaluate(() => (window as unknown as { __veil: { getState(): { updateSettings(p: object): void } } }).__veil.getState().updateSettings({ reducedMotion: true }));
});

/** Taps through an episode from the first decision to the summary; returns what it saw. */
async function playThrough(page: Page, o: { gift?: boolean; noPoll?: boolean } = {}) {
  const seen: Record<string, number> = { wheels: 0, prices: 0, claims: 0, cards: 0, mycards: 0, gifts: 0, giftLines: 0 };
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(50);
    await fits(page);
    // D-145: on Hard no screen shows the audience poll.
    if (o.noPoll) expect(await page.getByText(/\d+% risky/).count()).toBe(0);
    if (await page.locator('[data-gifts]').count()) seen.giftLines++;
    if (await page.locator('[data-summary]').count()) break;
    // V5 N3: the new price shows at the top of the next round's first screen.
    if (await page.locator('[data-carry-extra]').count()) seen.prices++;
    if (await page.locator('[data-beat-next]').count()) {
      if (await page.locator('[data-outcome]').count()) seen.wheels++;
      // UI V3 (U3): the price board moves on by itself, so its button is a beat button now.
      if (await page.locator('[data-price]').count()) seen.prices++;
      if (await page.locator('[data-mycards]').count()) {
        seen.mycards++;
        await expect(page.getByText('Nobody knows how many players are high risk or Worriers. Not even the host.')).toBeVisible();
      }
      await page.locator('[data-beat-next]').click();
    } else if (await page.getByRole('button', { name: 'Say it' }).count()) {
      seen.claims++;
      await expect(page.getByText(/Your risk: (low|high)/)).toBeVisible();
      await expect(page.getByText(/of you (are|is) high risk/)).toHaveCount(0);
      await page.getByRole('button', { name: /low risk/ }).click();
      await page.getByRole('button', { name: 'Say it' }).click();
    } else if (await page.getByRole('heading', { name: 'Keep someone out of the pool?' }).count()) {
      // UI V4 (V2): a pool member's bar vote is its own screen, before the cover question.
      seen.bars = (seen.bars ?? 0) + 1;
      await page.getByRole('button', { name: 'Nobody', exact: true }).click();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    } else if (await page.locator('[data-cards]').count()) {
      seen.cards++;
      await page.getByRole('button', { name: 'Tap to continue' }).click();
    } else if (await page.getByRole('button', { name: 'Lock in', exact: true }).count()) {
      await expect(page.getByText(/^Your risk/)).toBeVisible();
      const buy = page.getByRole('button', { name: /Buy cover/ });
      if (await buy.count()) await buy.click();
      // D-142: give once, the first time the move screen comes up.
      if (o.gift && !seen.gifts) {
        await page.locator('[data-gift-bar]').click();
        // UI V4 (V1): the picker opens in place, not in a sheet.
        expect(await page.locator('[role="dialog"]').count()).toBe(0);
        await page.locator('[data-gift-sheet] [data-gift]').first().click();
        await expect(page.getByRole('button', { name: /^Give: 5 to / })).toBeVisible();
        seen.gifts++;
      }
      await page.getByRole('button', { name: 'Lock in', exact: true }).click();
    } else if (await page.getByRole('button', { name: 'Cast my vote' }).count()) {
      await page.getByRole('button', { name: /Full cover for all/ }).click();
      await page.getByRole('button', { name: 'Cast my vote' }).click();
    } else if (await page.locator('[data-price]').count()) {
      seen.prices++;
      await page.getByRole('button', { name: /^(Round \d|To the vote)$/ }).click();
    } else if (await page.locator('[data-outcome]').count()) {
      seen.wheels++;
      await page.getByRole('button', { name: 'Tap to continue' }).click();
    } else throw new Error(`unknown screen: ${(await page.locator('body').innerText()).slice(0, 200)}`);
  }
  return seen;
}

test('plays Episode 3 from the title to the episode summary', async ({ page }) => {
  await page.getByRole('button', { name: 'Start a new life' }).click();
  await page.getByRole('button', { name: /Quick and fun/ }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: /Bad Luck Season/ }).click();
  // D-141: four seats by default; D-147: the challenge code and its hint.
  await expect(page.locator('[data-seats="4"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-seats="4"]')).toContainText('Best with 4');
  await expect(page.getByText('Same code, same game. Use it to play the exact game a friend played.')).toBeVisible();
  await page.getByLabel('Challenge code (optional)').fill('e2e-play');
  await page.getByLabel('Your stage name').fill('Ana');
  await page.getByRole('button', { name: 'Go live' }).click();
  // V5 N1: no mission card; the game opens on the episode's "How this episode works" card.
  await expect(page.getByText('Your secret mission')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Bad Luck Season' })).toBeVisible();
  await fits(page);
  await page.getByRole('button', { name: 'Roll the cameras' }).click();
  // D-146: your chosen name, not "You", on your ringed podium (UI V3: the podiums replaced the top bar's row).
  await expect(page.locator('[data-cast-stage]').getByText('Ana', { exact: true })).toBeVisible();
  await expect(page.locator('[data-cast-stage]').getByText('You', { exact: true })).toHaveCount(0);
  const seen = await playThrough(page, { gift: true });
  expect(seen.wheels).toBe(4);
  expect(seen.prices).toBeGreaterThanOrEqual(1);
  expect(seen.claims).toBeGreaterThanOrEqual(1);
  expect(seen.cards).toBe(1);
  expect(seen.mycards).toBe(1);
  expect(seen.gifts).toBe(1);
  expect(seen.giftLines).toBeGreaterThanOrEqual(1);
  await expect(page.getByText('Biggest lie')).toBeVisible();
  await expect(page.getByText('Near miss')).toBeVisible();
  // V5 N3: the summary is at most 50 words; "What was really going on?" is in the menu.
  const words = await page.locator('[data-content]').evaluate((el) => (el as HTMLElement).innerText.trim().split(/\s+/).length);
  expect(words).toBeLessThanOrEqual(50);
  expect(await page.locator('[role="dialog"]').count()).toBe(0);
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await page.getByText('What was really going on?').click();
  await expect(page.getByText("That's adverse selection.", { exact: false })).toBeVisible();
});

test('two seats on Hard: the setup line, two contestants, no audience poll on any screen (D-141, D-145)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start a new life' }).click();
  await page.getByRole('button', { name: /Quick and fun/ }).click();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: /Bad Luck Season/ }).click();
  await expect(page.getByText('The standard game.')).toBeVisible();
  await page.locator('[data-difficulty="EASY"]').click();
  await expect(page.getByText('See what the audience thinks. Bots are mostly honest.')).toBeVisible();
  await page.locator('[data-difficulty="HARD"]').click();
  await expect(page.getByText('No audience poll. Bots lie more.')).toBeVisible();
  await page.locator('[data-seats="2"]').click();
  await page.getByLabel('Challenge code (optional)').fill('e2e-hard');
  await page.getByRole('button', { name: 'Go live' }).click();
  await page.getByRole('button', { name: 'Roll the cameras' }).click();
  await expect(page.locator('[data-podium]')).toHaveCount(2);
  // A blank name shows "You".
  await expect(page.locator('[data-cast-stage]').getByText('You', { exact: true })).toBeVisible();
  const seen = await playThrough(page, { noPoll: true });
  expect(seen.wheels).toBe(4);
  await expect(page.locator('[data-summary]')).toBeVisible();
});

test('the opening card: shown on the first visit, Skip goes to Pick your show, the menus reopen it (D-139, UI V3 U3)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start a new life' }).click();
  await page.getByRole('button', { name: /Quick and fun/ }).click();
  await expect(page.getByRole('heading', { name: 'A game show about fair play' })).toBeVisible();
  // UI V4 (V1): the card is a screen of its own (no overlay): it must fit, with no scrolling either way.
  const card = await page.locator('[data-opening]').evaluate((el) => ({ sh: el.scrollHeight, sw: el.scrollWidth, cw: el.clientWidth, ih: window.innerHeight }));
  expect(card.sw).toBeLessThanOrEqual(card.cw);
  expect(card.sh).toBeLessThanOrEqual(card.ih);
  await expect(page.getByRole('button', { name: 'Next' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('heading', { name: 'Pick your show' })).toBeVisible();
  // Seen once: going back and in again shows no card.
  await page.reload();
  await page.waitForFunction(() => '__veil' in window);
  await page.evaluate(() => (window as unknown as { __veil: { getState(): { go(s: string): void } } }).__veil.getState().go('playMode'));
  await expect(page.getByRole('heading', { name: 'Pick your show' })).toBeVisible();
  await expect(page.locator('[data-opening]')).toHaveCount(0);
  // "What is this game?" reopens it, here and from the in-game menu.
  await page.getByRole('button', { name: 'What is this game?' }).click();
  await expect(page.getByRole('heading', { name: 'A game show about fair play' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: /Bad Luck Season/ }).click();
  await page.getByRole('button', { name: 'Go live' }).click();
  await page.getByRole('button', { name: 'Roll the cameras' }).click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'What is this game?' }).click();
  await expect(page.getByRole('heading', { name: 'A game show about fair play' })).toBeVisible();
  await page.getByRole('button', { name: "Let's play" }).click();
  await expect(page.locator('[data-opening]')).toHaveCount(0);
});

test('UI V4 V1: calling is confirmed inside the bubble, and first-time hints are lines in the screen', async ({ page }) => {
  type V = { __veil: { getState(): { start(o: object): void; game: { phase: { kind: string; step?: string } } } }; __autoplay(f: (g: unknown) => boolean): void };
  // A first-time player: hint lines on.
  await page.evaluate(() => localStorage.setItem('veil.play.coach', '1'));
  await page.evaluate(() => (window as unknown as V).__veil.getState().start({ mode: 'EPISODE', level: 3, ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: 'v4-call-1' }));
  let called = false;
  for (let i = 0; i < 60 && !called; i++) {
    await page.waitForTimeout(60);
    if (await page.locator('[data-coach]').count()) {
      // A hint is a line in the flow of the screen, never fixed on top of it.
      const pos = await page.locator('[data-coach]').first().evaluate((el) => getComputedStyle(el).position);
      expect(pos).toBe('static');
    }
    const bubble = page.locator('[data-call-bubble]').first();
    if (await bubble.count()) {
      const id = await bubble.getAttribute('data-call-bubble');
      await bubble.click();
      const confirm = page.locator(`[data-podium], [data-cast-stage] [data-bubble="${id}"][data-call-confirm]`);
      await expect(page.locator('[data-call-confirm]')).toHaveCount(1);
      await expect(confirm.last()).toBeVisible();
      expect(await page.locator('[role="dialog"]').count()).toBe(0);
      await expect(page.locator('[data-call-confirm]').getByRole('button', { name: 'Call it, 10' })).toBeVisible();
      await page.locator('[data-call-confirm]').getByRole('button', { name: 'Cancel' }).click();
      await expect(page.locator('[data-call-confirm]')).toHaveCount(0);
      await page.locator(`[data-call-bubble="${id}"]`).click();
      await page.locator('[data-call-yes]').click();
      await expect(page.locator(`[data-call-bubble="${id}"]`)).toHaveAttribute('aria-pressed', 'true');
      called = true;
      break;
    }
    if (await page.locator('[data-beat-next]').count()) {
      await page.locator('[data-beat-next]').first().click();
      continue;
    }
    await page.evaluate(() => {
      const w = window as unknown as V;
      const g0 = w.__veil.getState().game;
      w.__autoplay((g) => g !== g0);
    });
  }
  expect(called).toBe(true);
});

test('UI V4 V4: with auto-advance on, a screen of more than 8 words waits for a tap', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile-360', 'One phone run is enough.');
  type V = { __veil: { getState(): { start(o: object): void; game: { phaseIdx: number } } }; __autoplay(f: (g: unknown) => boolean): void };
  await page.evaluate(() => localStorage.setItem('veil.play.auto', '1'));
  await page.evaluate(() => (window as unknown as V).__veil.getState().start({ mode: 'EPISODE', level: 3, ruleset: 'PLAY', nPlayers: 4, difficulty: 'NORMAL', seed: 'v4-pace-1' }));
  let beats = 0;
  for (let i = 0; i < 60 && beats < 6; i++) {
    await page.waitForTimeout(80);
    const next = page.locator('[data-beat-next]');
    if (await next.count()) {
      const words = await page.evaluate(() => ((document.querySelector('[data-content]') as HTMLElement | null)?.innerText ?? '').trim().split(/\s+/).filter(Boolean).length);
      const text = await page.locator('[data-content]').innerText();
      if (words > 8) {
        expect(await page.locator('[data-auto]').count()).toBe(0);
        await page.waitForTimeout(2000);
        expect(await page.locator('[data-content]').innerText()).toBe(text);
      }
      beats++;
      await next.first().click();
      continue;
    }
    await page.evaluate(() => {
      const w = window as unknown as V;
      const g0 = w.__veil.getState().game;
      w.__autoplay((g) => g !== g0);
    });
  }
  expect(beats).toBeGreaterThanOrEqual(4);
});
