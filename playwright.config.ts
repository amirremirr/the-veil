import { defineConfig, devices } from '@playwright/test';

// Set PW_CHANNEL=msedge or PW_CHANNEL=chrome to use an installed browser instead of
// downloading Playwright's bundled Chromium (`npx playwright install chromium`).
const channel = process.env.PW_CHANNEL || undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 120_000,
  webServer: { command: 'npm run dev -- --port 5199 --strictPort', port: 5199, reuseExistingServer: true },
  use: { baseURL: 'http://localhost:5199', channel },
  projects: [
    { name: 'mobile-360', use: { ...devices['Pixel 5'], viewport: { width: 360, height: 760 }, channel } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], channel } },
  ],
});
