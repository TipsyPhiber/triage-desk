import { defineConfig, devices } from '@playwright/test';

// Browser tests run against both distributions (single file over file://,
// and the hosted build over http). Build them first with `npm run test:e2e`,
// which runs e2e/prepare.mjs.
//
// Pick browsers with --project, e.g. `npm run test:e2e -- --project=firefox`.
// Edge is added on Windows, where CI runners have it preinstalled.

const PORT = 4180;
const CONNECTED_PORT = 4181;
// Not 4190: that port (ManageSieve) is on the Fetch spec's blocked-port list,
// which Firefox and WebKit enforce.
const SPLUNK_PORT = 4210;

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
  webServer: [
    {
      command: `npx vite preview --outDir dist-e2e --port ${PORT} --strictPort`,
      url: `http://localhost:${PORT}/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npx vite preview --outDir dist-e2e-connected --port ${CONNECTED_PORT} --strictPort`,
      url: `http://localhost:${CONNECTED_PORT}/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      // Stand-in for a customer's Splunk (REST search + HEC) with CORS.
      command: `node e2e/mock-splunk.mjs ${SPLUNK_PORT}`,
      url: `http://localhost:${SPLUNK_PORT}/__health`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});

export { PORT, CONNECTED_PORT, SPLUNK_PORT };
