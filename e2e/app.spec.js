import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LICENSE = readFileSync(join(ROOT, 'e2e/.tmp/license.txt'), 'utf8').trim();
const PORT = 4180;

const TARGETS = [
  { name: 'single file', url: pathToFileURL(join(ROOT, 'dist-e2e-single/triage-desk.html')).href },
  { name: 'hosted', url: `http://localhost:${PORT}/` },
];

// Fail the test on any page error, console error (CSP violations log here),
// or request that leaves the app's own origin.
function watch(page, url) {
  const problems = [];
  const origin = new URL(url).origin;
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('request', (r) => {
    const u = r.url();
    const local = u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('file:') || (origin !== 'null' && u.startsWith(origin));
    if (!local) problems.push(`network: ${u}`);
  });
  page.on('dialog', (d) => d.accept());
  return problems;
}

async function openIncidentMenu(page, name) {
  await page.locator('aside button', { hasText: name }).first().click();
}

for (const target of TARGETS) {
  test.describe(target.name, () => {
    test('customer flow: free tier, activation, Pro features, persistence', async ({ page }) => {
      const problems = watch(page, target.url);
      await page.goto(target.url);
      await expect(page.getByText('Start an incident')).toBeVisible();

      // Free tier
      await page.getByText('Quick start (General playbook)').click();
      await page.getByPlaceholder(/Incident name/).fill('INC-1 Phishing');
      await page.getByRole('button', { name: 'Declare Incident' }).click();
      await expect(page.getByRole('heading', { name: 'Identification' })).toBeVisible();
      await page.getByText('Triage initial alert').click();

      // IOC extractor (WASM)
      await page.getByRole('button', { name: 'Open' }).click();
      await page.getByText('Try sample').click();
      await page.getByRole('button', { name: 'Extract IOCs' }).click();
      await page.getByRole('button', { name: 'Append to Notes' }).click();
      await expect(page.locator('textarea').last()).toHaveValue(/IOCs extracted[\s\S]*185\.220\.101\.45/);

      // Free limit → upgrade panel
      await openIncidentMenu(page, 'INC-1 Phishing');
      await page.getByText('+ New incident').click();
      await expect(page.getByText("You're on Triage Desk Free")).toBeVisible();

      // Bad key rejected, real key accepted
      await page.getByPlaceholder('TD1.…').fill('TD1.bogus.key');
      await page.getByRole('button', { name: 'Activate' }).click();
      await expect(page.getByText(/not valid|corrupted|doesn't look like/)).toBeVisible();
      await page.getByPlaceholder('TD1.…').fill(LICENSE);
      await page.getByRole('button', { name: 'Activate' }).click();
      await expect(page.getByText('Triage Desk Pro is active')).toBeVisible();
      await page.keyboard.press('Escape');

      // Pro playbook
      await openIncidentMenu(page, 'INC-1 Phishing');
      await page.getByText('+ New incident').click();
      await page.getByPlaceholder(/INC-2026-0142/).fill('INC-2 Ransomware');
      await page.getByRole('button', { name: /^Ransomware/ }).click();
      await page.getByRole('button', { name: 'Create incident' }).click();
      await page.getByRole('button', { name: 'Declare Incident' }).click();
      await expect(page.getByText('Photograph or copy the ransom note')).toBeVisible();

      // All three report formats download
      for (const [label, ext] of [['Plain text', 'txt'], ['Markdown', 'md'], ['Printable HTML', 'html']]) {
        await page.getByRole('button', { name: /Export Report/ }).click();
        const [dl] = await Promise.all([page.waitForEvent('download'), page.getByText(label).click()]);
        expect(dl.suggestedFilename()).toMatch(new RegExp(`^inc-2-ransomware-.*\\.${ext}$`));
      }

      // Survives a reload: both incidents and the license
      await page.reload();
      await expect(page.locator('aside').getByText('PRO').first()).toBeVisible();
      await openIncidentMenu(page, 'INC-2 Ransomware');
      await expect(page.locator('aside li', { hasText: 'INC-1 Phishing' })).toBeVisible();
      await page.keyboard.press('Escape');

      // Custom playbook
      await page.getByRole('button', { name: 'Playbooks' }).click();
      await page.getByRole('button', { name: /Duplicate/ }).click();
      await page.locator('[role=dialog] textarea').nth(2).fill('Page the IR retainer');
      await page.getByRole('button', { name: 'Save playbook' }).click();
      await expect(page.getByText('Page the IR retainer')).toBeVisible();

      expect(problems).toEqual([]);
    });

    test('hostile input never executes', async ({ page }) => {
      const problems = watch(page, target.url);
      await page.goto(target.url);
      await page.evaluate(() => { window.__pwned = false; });
      await page.getByText('Quick start (General playbook)').click();
      const xss = '<img src=x onerror="window.__pwned=true">';
      await page.getByPlaceholder(/Incident name/).fill(xss);
      await page.locator('textarea').last().fill(`${xss}\n<script>window.__pwned=true</script>`);
      await page.getByPlaceholder(/One-line observation/).fill(xss);
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await page.getByRole('button', { name: /^Timeline/ }).click();
      expect(await page.evaluate(() => window.__pwned)).toBe(false);
      expect(problems).toEqual([]);
    });
  });
}
