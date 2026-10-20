// Version checks between page and room server (D-83), against the local room server that
// playwright.config.ts starts (`wrangler dev --var DEV:1`). The dev-only window.__roomRules hook makes this
// page pretend to run other rules: `send` changes what it sends with JOIN (the server's check), `expect`
// changes what it compares the server's WELCOME with (the page's check).
import { expect, test, type Browser, type Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const OTHER = { rules: 'outdated0000', params: 'outdated0000', commit: 'unknown' };
const SERVER = 'http://127.0.0.1:8788';

async function newPage(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 760 } });
  const page = await ctx.newPage();
  await page.goto('/');
  await page.waitForFunction(() => typeof (window as unknown as { __roomRules?: unknown }).__roomRules === 'function');
  return page;
}

async function createRoom(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Play with friends' }).click();
  await page.getByLabel('Your name').fill('Ana');
  await page.getByRole('button', { name: /One level/ }).click();
  await page.getByRole('button', { name: /Behind the Veil/ }).click();
  await page.getByRole('button', { name: 'Create room' }).click();
}

test.beforeEach(({}, info) => {
  test.skip(info.project.name !== 'desktop', 'One run is enough; every page already uses a 375 px viewport.');
});

test('a page with other rules is refused by the server', async ({ browser }) => {
  const page = await newPage(browser);
  await page.evaluate((r) => (window as unknown as { __roomRules: (x: object) => void }).__roomRules({ send: r }), OTHER);
  await createRoom(page);
  await expect(page.getByRole('alert').first()).toHaveText('The game was updated. Reload the page to play.');
  await expect(page.getByText('Check the code')).toHaveCount(0);
});

test('a server with other rules is refused by the page', async ({ browser }) => {
  const page = await newPage(browser);
  await page.evaluate((r) => (window as unknown as { __roomRules: (x: object) => void }).__roomRules({ expect: r }), OTHER);
  await createRoom(page);
  await expect(page.getByRole('alert').first()).toHaveText('The game was updated. Reload the page to play.');
});

test('a room closed by an update says so, during the game and to anyone joining later', async ({ browser, request }) => {
  const ana = await newPage(browser);
  await createRoom(ana);
  const codeEl = ana.locator('[data-room-code]');
  await expect(codeEl).toHaveText(/^[A-Z]{4}$/);
  const code = (await codeEl.textContent())!;
  await ana.getByRole('button', { name: 'Start the game' }).click();
  await expect(ana.locator('[data-countdown]')).toBeVisible();

  // The room now behaves as if a deploy changed the rules it started under.
  const r = await request.get(`${SERVER}/rooms/${code}/outdate`, { headers: { Origin: 'http://localhost:5199' } });
  expect(await r.json()).toEqual({ ok: true, closedByUpdate: true });
  await expect(ana.locator('[data-fatal="CLOSED_BY_UPDATE"]')).toHaveText('This room closed because the game was updated.');

  // Someone opening the invite link afterwards is told the same, not "Check the code".
  const ben = await newPage(browser);
  await ben.goto(`/?room=${code}`);
  await ben.getByLabel('Your name').fill('Ben');
  await ben.getByRole('button', { name: 'Join room' }).click();
  await expect(ben.getByRole('alert').first()).toHaveText('This room closed because the game was updated.');
  await expect(ben.getByText('Check the code')).toHaveCount(0);
});
