import { defineConfig, devices } from '@playwright/test';

// Set PW_CHANNEL=msedge or PW_CHANNEL=chrome to use an installed browser instead of
// downloading Playwright's bundled Chromium (`npx playwright install chromium`).
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  webServer: [
    // The site, pointed at a local room server for the multiplayer test.
    { command: 'npm run dev -- --port 5199 --strictPort', port: 5199, reuseExistingServer: true, env: { VITE_ROOM_SERVER_URL: 'http://127.0.0.1:8788' } },
    { command: 'npx wrangler dev --var DEV:1 --port 8788 --ip 127.0.0.1', cwd: 'server', port: 8788, reuseExistingServer: true, timeout: 120_000, env: { WRANGLER_SEND_METRICS: 'false' } },
  ],
  use: { baseURL: 'http://localhost:5199', channel },
  projects: [
    { name: 'mobile-360', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 760 }, channel } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel } },
  ],
});
