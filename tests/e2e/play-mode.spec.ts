// Play mode, Episode 3 (The Pool, PLAY_V2_SPEC.md Q1), solo, through the real UI: from the title to the
// episode summary, tapping through every beat. No screen may scroll, sideways or down.
import { expect, test, type Page } from '@playwright/test';

async function fits(page: Page) {
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
  const seen = { wheels: 0, prices: 0, claims: 0, cards: 0, mycards: 0, gifts: 0, giftLines: 0 };
  for (let i = 0; i < 50; i++) {
    await page.waitForTimeout(50);
    await fits(page);
    // D-145: on Hard no screen shows the audience poll.
    if (o.noPoll) expect(await page.getByText(/\d+% risky/).count()).toBe(0);
    if (await page.locator('[data-gifts]').count()) seen.giftLines++;
    if (await page.getByText('Episode summary').count()) break;
    if (await page.locator('[data-beat-next]').count()) {
      if (await page.locator('[data-outcome]').count()) seen.wheels++;
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
    } else if (await page.locator('[data-cards]').count()) {
      seen.cards++;
      await page.getByRole('button', { name: 'Tap to continue' }).click();
    } else if (await page.getByRole('button', { name: 'Lock in', exact: true }).count()) {
      await expect(page.getByText(/^Your risk/)).toBeVisible();
      const buy = page.getByRole('button', { name: /Buy cover/ });
      if (await buy.count()) await buy.click();
      // D-142: give once, the first time the move screen comes up.
      if (o.gift && !seen.gifts) {
        await page.getByRole('button', { name: /^Give/ }).click();
        await page.locator('[data-gift-sheet] [data-gift]').first().click();
        await expect(page.getByRole('button', { name: /^Give 5 to / })).toBeVisible();
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
    } else if (await page.getByRole('heading', { name: 'Guess a mission' }).count()) {
      await page.getByRole('button', { name: 'Get rich' }).click();
      await page.getByRole('button', { name: 'Lock in my guess' }).click();
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
  await expect(page.getByText('Same code, same game. Use it to play the exact game a friend played.')).toBeVisible();
  await page.getByLabel('Challenge code (optional)').fill('e2e-play');
  await page.getByLabel('Your stage name').fill('Ana');
  await page.getByRole('button', { name: 'Go live' }).click();
  await expect(page.getByText('Your secret mission')).toBeVisible();
  await fits(page);
  await page.getByRole('button', { name: 'Accept the mission' }).click();
  await expect(page.getByRole('heading', { name: 'Bad Luck Season' })).toBeVisible();
  await fits(page);
  // D-146: your chosen name, not "You", under your ringed face in the top bar.
  await expect(page.locator('header').getByText('Ana', { exact: true })).toBeVisible();
  await expect(page.locator('header').getByText('You', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Roll the cameras' }).click();
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
  await expect(page.getByText('Episode summary')).toBeVisible();
  await page.getByRole('button', { name: 'What was really going on?' }).click();
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
  await expect(page.getByText('No audience poll. Bots lie more and bar harder.')).toBeVisible();
  await page.locator('[data-seats="2"]').click();
  await page.getByLabel('Challenge code (optional)').fill('e2e-hard');
  await page.getByRole('button', { name: 'Go live' }).click();
  await page.getByRole('button', { name: 'Accept the mission' }).click();
  await expect(page.locator('header li')).toHaveCount(2);
  // A blank name shows "You".
  await expect(page.locator('header').getByText('You', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Roll the cameras' }).click();
  const seen = await playThrough(page, { noPoll: true });
  expect(seen.wheels).toBe(4);
  await expect(page.getByText('Episode summary')).toBeVisible();
});

test('the opening cards: shown on the first visit, Skip goes to Pick your show, the menus reopen them (D-139)', async ({ page }) => {
  await page.getByRole('button', { name: 'Start a new life' }).click();
  await page.getByRole('button', { name: /Quick and fun/ }).click();
  await expect(page.getByRole('heading', { name: 'A game show about fair play' })).toBeVisible();
  // The cards are a fixed overlay: the card itself must fit, with no scrolling either way.
  const card = await page.locator('[data-opening]').evaluate((el) => ({ sh: el.scrollHeight, sw: el.scrollWidth, cw: el.clientWidth, ih: window.innerHeight }));
  expect(card.sw).toBeLessThanOrEqual(card.cw);
  expect(card.sh).toBeLessThanOrEqual(card.ih);
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Everyone has secrets' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('heading', { name: 'Pick your show' })).toBeVisible();
  // Seen once: going back and in again shows no cards.
  await page.reload();
  await page.waitForFunction(() => '__veil' in window);
  await page.evaluate(() => (window as unknown as { __veil: { getState(): { go(s: string): void } } }).__veil.getState().go('playMode'));
  await expect(page.getByRole('heading', { name: 'Pick your show' })).toBeVisible();
  await expect(page.locator('[data-opening]')).toHaveCount(0);
  // "What is this game?" reopens them, here and from the in-game menu.
  await page.getByRole('button', { name: 'What is this game?' }).click();
  await expect(page.getByRole('heading', { name: 'A game show about fair play' })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await page.getByRole('button', { name: /Bad Luck Season/ }).click();
  await page.getByRole('button', { name: 'Go live' }).click();
  await page.getByRole('button', { name: 'Accept the mission' }).click();
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'What is this game?' }).click();
  await expect(page.getByRole('heading', { name: 'A game show about fair play' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: "Let's play" }).click();
  await expect(page.locator('[data-opening]')).toHaveCount(0);
});
