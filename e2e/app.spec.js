import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { expect, test } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LICENSE = readFileSync(join(ROOT, 'e2e/.tmp/license.txt'), 'utf8').trim();
const CONNECTED_LICENSE = readFileSync(join(ROOT, 'e2e/.tmp/license-connected.txt'), 'utf8').trim();
const PORT = 4180;
const CONNECTED_PORT = 4181;
const SPLUNK = 'http://localhost:4190';

const TARGETS = [
  { name: 'single file', url: pathToFileURL(join(ROOT, 'dist-e2e-single/triage-desk.html')).href },
  { name: 'hosted', url: `http://localhost:${PORT}/` },
];

// Fail the test on any page error, console error (CSP violations log here),
// or request that leaves the app's own origin.
function watch(page, url, { allow = [] } = {}) {
  const problems = [];
  const origin = new URL(url).origin;
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('request', (r) => {
    const u = r.url();
    const local = u.startsWith('data:') || u.startsWith('blob:') || u.startsWith('file:') || (origin !== 'null' && u.startsWith(origin)) || allow.some((a) => u.startsWith(a));
    if (!local) problems.push(`network: ${u}`);
  });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`http ${r.status()}: ${r.url()}`); });
  page.on('dialog', (d) => d.accept());
  return problems;
}

async function clickNewIncident(page) {
  await page.getByRole('button', { name: /New incident/ }).click();
}

// Start with a licensed, empty workspace.
async function seed(page, url, license) {
  await page.goto(url);
  await page.evaluate((key) => {
    localStorage.setItem('triage-desk-workspace-v2', JSON.stringify({
      version: 2, incidents: [], activeIncidentId: null, customPlaybooks: [],
      settings: { orgName: 'Example Co.', preparedBy: '', defaultTlp: 'TLP:AMBER' }, license: key,
    }));
  }, license);
  await page.reload();
}

for (const target of TARGETS) {
  test.describe(target.name, () => {
    test('customer flow: free tier, activation, Pro features, persistence', async ({ page }) => {
      const problems = watch(page, target.url);
      await page.goto(target.url);
      await expect(page.getByText('Start an incident')).toBeVisible();

      // Free tier
      await page.getByText('Quick start (General playbook)').click();
      await page.getByLabel('Incident name').fill('INC-1 Phishing');
      await page.getByRole('button', { name: 'Declare Incident' }).click();
      await expect(page.getByRole('heading', { name: 'Identification' })).toBeVisible();
      await page.getByText('Triage initial alert').click();

      // IOC extractor (WASM)
      await page.getByRole('button', { name: 'Open IOC extractor' }).click();
      await page.getByText('Try sample').click();
      await page.getByRole('button', { name: 'Extract IOCs' }).click();
      await page.getByRole('button', { name: 'Append to Notes' }).click();
      await expect(page.locator('textarea').last()).toHaveValue(/IOCs extracted[\s\S]*185\.220\.101\.45/);

      // Free limit → upgrade panel
      await clickNewIncident(page);
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
      await clickNewIncident(page);
      await page.getByRole('dialog').getByPlaceholder(/INC-2026-0142/).fill('INC-2 Ransomware');
      await page.getByLabel('Search playbooks').fill('ransomware');
      await page.getByRole('option', { name: /^Ransomware\s*Essentials/ }).click();
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
      await expect(page.locator('nav[aria-label="Incidents"]').getByText('INC-1 Phishing')).toBeVisible();
      await expect(page.locator('nav[aria-label="Incidents"]').getByText('INC-2 Ransomware')).toBeVisible();

      // Custom playbook
      await page.getByRole('button', { name: 'Playbooks' }).click();
      await page.getByRole('button', { name: /Duplicate/ }).click();
      await page.locator('[role=dialog] textarea').nth(2).fill('Page the IR retainer');
      await page.getByRole('button', { name: 'Save playbook' }).click();
      await expect(page.getByText('Page the IR retainer')).toBeVisible();

      expect(problems).toEqual([]);
    });

    test('in-app confirmation: cancel keeps the incident open, confirm resolves it', async ({ page }) => {
      const problems = watch(page, target.url);
      await page.goto(target.url);
      await page.getByText('Quick start (General playbook)').click();
      await page.getByRole('button', { name: 'Declare Incident' }).click();
      await page.getByRole('button', { name: 'Mark Resolved' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click();
      await expect(page.getByRole('button', { name: 'Mark Resolved' })).toBeVisible();
      await page.getByRole('button', { name: 'Mark Resolved' }).click();
      await page.getByRole('alertdialog').getByRole('button', { name: 'Mark resolved' }).click();
      await expect(page.getByRole('heading', { name: 'Lessons Learned' })).toBeVisible();
      await expect(page.getByText('Time to resolve')).toBeVisible();
      expect(problems).toEqual([]);
    });

    test('hostile input never executes', async ({ page }) => {
      const problems = watch(page, target.url);
      await page.goto(target.url);
      await page.evaluate(() => { window.__pwned = false; });
      await page.getByText('Quick start (General playbook)').click();
      const xss = '<img src=x onerror="window.__pwned=true">';
      await page.getByLabel('Incident name').fill(xss);
      await page.locator('textarea').last().fill(`${xss}\n<script>window.__pwned=true</script>`);
      await page.getByPlaceholder(/One-line observation/).fill(xss);
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await page.getByRole('button', { name: /^Timeline/ }).first().click();
      expect(await page.evaluate(() => window.__pwned)).toBe(false);
      expect(problems).toEqual([]);
    });

    test('guided start, playbook Splunk searches, and offline Splunk exports', async ({ page }) => {
      const problems = watch(page, target.url);
      await seed(page, target.url, LICENSE);
      await page.getByLabel("Describe what's happening").fill('aws access key leaked on github');
      await page.getByRole('list', { name: 'Suggested playbooks' }).getByRole('button').first().click();
      await expect(page.getByRole('dialog', { name: 'New incident' })).toBeVisible();
      await page.getByRole('button', { name: 'Create incident' }).click();
      await page.getByRole('button', { name: 'Declare Incident' }).click();

      // Library playbooks carry ready-to-copy SPL with fill-in values.
      const card = page.locator('main').getByRole('button', { name: /^Copy search:/ }).first();
      await expect(card).toBeVisible();
      await card.click();
      await expect(page.getByText(/Search copied/)).toBeVisible();

      // IOC hunting searches + exports in the side panel.
      await page.getByRole('button', { name: 'Open IOC extractor' }).click();
      await page.getByText('Try sample').click();
      await page.getByRole('button', { name: 'Extract IOCs' }).click();
      await page.getByRole('button', { name: 'Append to Notes' }).click();
      if (!(await page.getByRole('button', { name: /^Splunk/ }).isVisible())) await page.keyboard.press('t');
      await page.getByRole('button', { name: /^Splunk/ }).click();
      await expect(page.getByText(/Network traffic to or from/)).toBeVisible();
      for (const [label, ext] of [['IOC lookup table', 'csv'], ['Timeline as HEC events', 'json']]) {
        const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: new RegExp(label) }).click()]);
        expect(dl.suggestedFilename()).toMatch(new RegExp(`\\.${ext}$`));
      }
      // The offline build never offers live Splunk.
      await expect(page.getByRole('button', { name: /Send timeline to Splunk/ })).toHaveCount(0);
      expect(problems).toEqual([]);
    });

    test('import a Splunk alert, command palette, dark mode', async ({ page }) => {
      const problems = watch(page, target.url);
      await seed(page, target.url, LICENSE);
      await page.getByRole('button', { name: /Import a Splunk alert/ }).click();
      await page.getByRole('button', { name: 'Try sample' }).click();
      await expect(page.getByText('Suggested playbook')).toBeVisible();
      await page.getByRole('button', { name: 'Create incident' }).click();
      await expect(page.getByLabel('Incident name')).toHaveValue(/Suspicious PowerShell/);
      await expect(page.locator('textarea').last()).toHaveValue(/Imported from Splunk/);

      await page.keyboard.press('Control+k');
      await page.getByRole('textbox', { name: 'Command' }).fill('switch theme');
      await page.keyboard.press('Enter');
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      await page.reload();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
      expect(problems).toEqual([]);
    });
  });
}

test.describe('connected edition', () => {
  const url = `http://localhost:${CONNECTED_PORT}/`;

  test('runs searches, pulls notables, and sends the timeline to Splunk', async ({ page, request }) => {
    await request.get(`${SPLUNK}/__reset`);
    const problems = watch(page, url, { allow: [SPLUNK] });
    await seed(page, url, CONNECTED_LICENSE);
    await expect(page.getByText('CONNECTED')).toBeVisible();

    // Configure and test the connection.
    await page.keyboard.press('Control+k');
    await page.getByRole('textbox', { name: 'Command' }).fill('splunk settings');
    await page.keyboard.press('Enter');
    await page.getByPlaceholder('https://splunk.example.com:8089').fill(SPLUNK);
    await page.getByPlaceholder('eyJraWQi…').fill('test-token');
    await page.getByPlaceholder('https://splunk.example.com:8088').fill(SPLUNK);
    await page.getByPlaceholder('00000000-0000-…').fill('hec-token');
    await page.getByRole('button', { name: 'Test connection' }).click();
    await expect(page.getByText(/Connected to mock-splunk/)).toBeVisible();
    await page.keyboard.press('Escape');

    // Pull a notable into a new incident.
    await page.getByRole('button', { name: /Import a Splunk alert/ }).click();
    await page.getByRole('button', { name: 'Pull from Splunk' }).click();
    await page.getByRole('button', { name: /Brute force followed by success/ }).click();
    await page.getByRole('button', { name: 'Create incident' }).click();
    await expect(page.getByLabel('Incident name')).toHaveValue('Brute force followed by success');
    await page.getByRole('button', { name: 'Declare Incident' }).click();

    // Run a playbook search live and pull indicators from the results.
    await page.locator('main').getByRole('button', { name: 'Run' }).first().click();
    const results = page.getByRole('dialog');
    await expect(results.getByText('203.0.113.77')).toBeVisible();
    await results.getByRole('button', { name: /Extract IOCs from results/ }).click();
    await results.getByRole('button', { name: 'Done' }).click();

    // Send the timeline to HEC.
    if (!(await page.getByRole('button', { name: /^Splunk/ }).isVisible())) await page.keyboard.press('t');
    await page.getByRole('button', { name: /^Splunk/ }).click();
    await page.getByRole('button', { name: /Send timeline to Splunk/ }).click();
    await expect(page.getByText(/Sent \d+ events to Splunk/)).toBeVisible();
    const received = await (await request.get(`${SPLUNK}/__received`)).json();
    expect(received.length).toBeGreaterThan(1);
    expect(received[0]).toMatchObject({ sourcetype: 'triage_desk:timeline', event: { incident: 'Brute force followed by success' } });
    expect(problems).toEqual([]);
  });
});
