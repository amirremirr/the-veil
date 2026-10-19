// Three people in one room, each in their own browser context, against a local room server
// (`wrangler dev`, started by playwright.config.ts). One Level 1 round: two players vote, the third
// lets the 60-second timer run out; one player loses the connection and comes back.
import { expect, test, type Browser, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

async function newPlayer(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 760 } });
  const page = await ctx.newPage();
  return page;
}

async function noHorizontalScroll(page: Page) {
  const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(sw).toBeLessThanOrEqual(cw);
}

test('three players: create, join by code, one round, a timeout, a dropped connection', async ({ browser }, info) => {
  test.skip(info.project.name !== 'desktop', 'One run is enough; every player already uses a 375 px phone viewport.');
  test.setTimeout(240_000);
  const [ana, ben, cai] = await Promise.all([newPlayer(browser), newPlayer(browser), newPlayer(browser)]);

  // Ana creates a room for Level 1.
  await ana.goto('/');
  await ana.getByRole('button', { name: 'Play with friends' }).click();
  await ana.getByLabel('Your name').fill('Ana');
  await ana.getByRole('button', { name: /One level/ }).click();
  await ana.getByRole('button', { name: /Behind the Veil/ }).click();
  await ana.getByRole('button', { name: 'Create room' }).click();
  const codeEl = ana.locator('[data-room-code]');
  await expect(codeEl).toHaveText(/^[A-Z]{4}$/);
  const code = (await codeEl.textContent())!;
  await expect(ana.getByRole('button', { name: 'Copy invite link' })).toBeVisible();
  await expect(ana.getByText('Computer player')).toHaveCount(3);
  await noHorizontalScroll(ana);

  // Ben joins with the share link (code filled in), Cai types the code.
  await ben.goto(`/?room=${code}`);
  await expect(ben.getByLabel('Room code')).toHaveValue(code);
  await ben.getByLabel('Your name').fill('Ben');
  await ben.getByRole('button', { name: 'Join room' }).click();
  await cai.goto('/');
  await cai.getByRole('button', { name: 'Play with friends' }).click();
  await cai.getByRole('button', { name: 'Join a room' }).click();
  await cai.getByLabel('Room code').fill(code.toLowerCase());
  await cai.getByLabel('Your name').fill('Cai');
  await cai.getByRole('button', { name: 'Join room' }).click();
  for (const p of [ana, ben, cai]) await expect(p.locator('[data-seats] li')).toHaveCount(4);
  await expect(ana.getByText('Computer player')).toHaveCount(1);
  await expect(ben.getByText('Waiting for Ana to start the game.')).toBeVisible();
  await expect(ben.getByRole('button', { name: 'Start the game' })).toHaveCount(0);

  await ana.getByRole('button', { name: 'Start the game' }).click();

  // Values card and level intro: everyone presses Ready.
  for (let screen = 0; screen < 2; screen++) {
    for (const p of [ana, ben, cai]) {
      await expect(p.locator('[data-countdown]')).toBeVisible();
      await p.getByRole('button', { name: 'Ready', exact: true }).click();
    }
  }

  // Round 1: Ana and Ben vote; Cai waits. The talk stays open for Cai.
  for (const p of [ana, ben, cai]) await expect(p.getByRole('heading', { name: 'What others said' })).toBeVisible();
  await ana.getByRole('button', { name: /Safety Net/ }).click();
  await ana.getByRole('button', { name: 'Vote', exact: true }).click();
  await expect(ana.locator('[data-locked-in]')).toContainText('locked in');
  await expect(ana.locator('[data-locked-in]')).toContainText('Waiting for 2 players');
  await expect(cai.getByText('Locked in', { exact: false }).first()).toBeVisible();
  // Cai can still talk after Ana locked in.
  await cai.getByRole('button', { name: 'Reply' }).first().click();
  await cai.getByRole('button', { name: 'My card is...' }).click();
  await cai.getByRole('button', { name: 'Send' }).click();
  await cai.getByRole('button', { name: 'Back to my choice' }).click();
  await expect(ana.getByText('My card is Rawlsian.').locator('visible=true').first()).toBeVisible();
  await ben.getByRole('button', { name: /No Tax/ }).click();
  await ben.getByRole('button', { name: 'Vote', exact: true }).click();
  await expect(ben.locator('[data-locked-in]')).toContainText('Waiting for 1 player');

  // Cai never votes: after 60 seconds the computer chooses, and everyone sees the results.
  for (const p of [ana, ben, cai]) await expect(p.getByText('Winning rule', { exact: false }).first()).toBeVisible({ timeout: 75_000 });
  await noHorizontalScroll(cai);

  // Results: Ana presses Ready and waits for the other two.
  await ana.getByRole('button', { name: 'Ready', exact: true }).click();
  await expect(ana.locator('[data-waiting]')).toHaveText('Waiting for 2 players');

  // Ben loses the connection for a few seconds, then comes back to the same seat.
  await ben.evaluate(() => (window as unknown as { __roomDrop: (ms: number) => void }).__roomDrop(4000));
  await expect(ben.locator('[data-connection="lost"]')).toBeVisible();
  await expect(ben.locator('[data-connection="restored"]')).toBeVisible({ timeout: 15_000 });
  await expect(ben.getByText('Winning rule', { exact: false }).first()).toBeVisible();

  // A reload also keeps the seat (the seat token is stored for this room).
  await cai.reload();
  await expect(cai.getByText('Winning rule', { exact: false }).first()).toBeVisible({ timeout: 15_000 });

  await ben.getByRole('button', { name: 'Ready', exact: true }).click();
  await cai.getByRole('button', { name: 'Ready', exact: true }).click();
  for (const p of [ana, ben, cai]) await expect(p.getByText('Round 2 of 3')).toBeVisible();
  await noHorizontalScroll(ana);
});
