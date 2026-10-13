import { defineConfig, devices } from '@playwright/test';

// Browser tests run against both distributions (single file over file://,
// and the hosted build over http). Build them first with `npm run test:e2e`,
// which runs e2e/prepare.mjs.
//
// Pick browsers with --project, e.g. `npm run test:e2e -- --project=firefox`.
// Edge is added on Windows, where CI runners have it preinstalled.

const PORT = 4180;

const projects = [
  { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
];
if (process.platform === 'win32') {
  projects.push({ name: 'edge', use: { ...devices['Desktop Edge'], channel: 'msedge' } });
}

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    acceptDownloads: true,
    viewport: { width: 1400, height: 900 },
    trace: 'retain-on-failure',
  },
  projects,
  webServer: {
    command: `npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env.CI,
  },
});

export { PORT };
