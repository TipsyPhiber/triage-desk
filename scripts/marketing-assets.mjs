#!/usr/bin/env node
// Generate marketing screenshots and a demo video from the real app.
//
//   npm run marketing:assets
//
// Builds the e2e variant (throwaway license key, so Pro features show),
// seeds a realistic demo workspace through the app's own incident
// operations, and captures site/assets/*.png plus site/assets/demo.webm.
//
// All indicators use documentation-reserved ranges (RFC 5737 IPs, .example
// domains) so no real infrastructure appears in marketing material.

import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';
import { demoWorkspace } from './demo-workspace.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site/assets');

execSync('node e2e/prepare.mjs', { cwd: ROOT, stdio: 'inherit' });
const LICENSE = readFileSync(join(ROOT, 'e2e/.tmp/license.txt'), 'utf8').trim();
const APP = pathToFileURL(join(ROOT, 'dist-e2e-single/triage-desk.html')).href;

// ---------------------------------------------------------------------------

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();

async function page({ seed = true, video = false, width = 1600, height = 1000, theme = 'light' } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: video ? 1 : 2,
    acceptDownloads: true,
    ...(video ? { recordVideo: { dir: join(OUT, 'video-tmp'), size: { width, height } } } : {}),
  });
  const ws = seed
    ? JSON.stringify(demoWorkspace(Date.now(), LICENSE))
    : JSON.stringify({ version: 2, incidents: [], activeIncidentId: null, customPlaybooks: [], settings: { orgName: 'Example Co. Security Operations', preparedBy: '', defaultTlp: 'TLP:AMBER' }, license: LICENSE });
  await ctx.addInitScript(([data, th]) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('triage-desk-workspace-v2', data);
      localStorage.setItem('triage-desk-theme', th);
      sessionStorage.setItem('seeded', '1');
    }
  }, [ws, theme]);
  const pg = await ctx.newPage();
  pg.on('dialog', (d) => d.accept());
  await pg.goto(APP);
  return { ctx, pg };
}

const shot = (pg, name, opts = {}) => pg.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 90, ...opts });
const crop = async (pg, locator, name, maxH) => {
  const box = await locator.boundingBox();
  await shot(pg, name, { clip: { x: box.x, y: box.y, width: box.width, height: maxH ? Math.min(box.height, maxH) : box.height } });
};

// Start screen and guided search.
{
  const { ctx, pg } = await page({ seed: false });
  await pg.getByText("What’s happening?").waitFor();
  await pg.waitForTimeout(400);
  await shot(pg, 'app-welcome');
  await pg.getByLabel("Describe what's happening").pressSequentially('user entered password on a phishing page', { delay: 10 });
  await pg.waitForTimeout(300);
  await shot(pg, 'app-welcome-search');
  await pg.getByRole('button', { name: 'Find playbook' }).click();
  await pg.waitForTimeout(400);
  await shot(pg, 'app-finder');
  await crop(pg, pg.getByRole('dialog'), 'crop-finder');
  await pg.keyboard.press('Escape');
  await pg.getByRole('button', { name: /Import a Splunk alert/ }).click();
  await pg.getByRole('button', { name: 'Try sample' }).click();
  await pg.waitForTimeout(300);
  await crop(pg, pg.getByRole('dialog'), 'crop-import');
  await ctx.close();
}

// A live incident.
{
  const { ctx, pg } = await page();
  await pg.getByText('Backup VLAN isolated').first().waitFor().catch(() => {});
  await pg.waitForTimeout(600);
  await shot(pg, 'app-incident');
  await crop(pg, pg.locator('main'), 'crop-checklist', 640);

  await pg.locator('nav[aria-label="Phases"]').getByRole('button', { name: /Identification/ }).click();
  await pg.waitForTimeout(300);
  await shot(pg, 'app-identification');
  const searches = pg.locator('main section').filter({ hasText: 'Splunk searches' }).first();
  await searches.scrollIntoViewIfNeeded();
  await pg.waitForTimeout(200);
  await crop(pg, searches, 'crop-splunk-searches', 620);

  await pg.getByRole('button', { name: /^Splunk/ }).click();
  await pg.waitForTimeout(300);
  await crop(pg, pg.locator('aside[aria-label="Incident intel"]'), 'crop-splunk-hunt', 760);
  await pg.getByRole('button', { name: /^IOCs/ }).click();
  await pg.waitForTimeout(300);
  await crop(pg, pg.locator('aside[aria-label="Incident intel"]'), 'crop-iocs', 560);
  await pg.getByRole('button', { name: /^Timeline/ }).last().click();

  await pg.keyboard.press('Control+k');
  await pg.getByRole('textbox', { name: 'Command' }).pressSequentially('okta admin', { delay: 10 });
  await pg.waitForTimeout(300);
  await shot(pg, 'app-palette');
  await pg.keyboard.press('Escape');

  await pg.getByRole('button', { name: /Export Report/ }).click();
  await pg.waitForTimeout(200);
  await shot(pg, 'app-export');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.getByText('Printable HTML').click()]);
  const reportPath = join(OUT, 'sample-report.html');
  await dl.saveAs(reportPath);
  const rp = await ctx.newPage();
  await rp.setViewportSize({ width: 1000, height: 1300 });
  await rp.goto(pathToFileURL(reportPath).href);
  await rp.screenshot({ path: join(OUT, 'report.jpg'), type: 'jpeg', quality: 90 });
  await ctx.close();
}

// Dark mode.
{
  const { ctx, pg } = await page({ theme: 'dark' });
  await pg.getByText('Backup VLAN isolated').first().waitFor().catch(() => {});
  await pg.waitForTimeout(500);
  await shot(pg, 'app-dark');
  await ctx.close();
}

// Demo video: from "what's happening?" to a worked phishing incident.
{
  const { ctx, pg } = await page({ seed: false, video: true, width: 1600, height: 1000 });
  const pause = (ms) => pg.waitForTimeout(ms);
  await pg.getByText("What’s happening?").waitFor();
  await pause(900);
  await pg.getByLabel("Describe what's happening").pressSequentially('user entered password on a phishing page', { delay: 45 });
  await pause(900);
  await pg.getByRole('list', { name: 'Suggested playbooks' }).getByRole('button').first().click();
  await pause(1000);
  await pg.getByRole('dialog').getByPlaceholder(/INC-2026-0142/).pressSequentially('INC-2026-0148 · Payroll phishing', { delay: 35 });
  await pause(500);
  await pg.getByRole('button', { name: 'Create incident' }).click();
  await pause(700);
  await pg.getByRole('button', { name: 'Declare Incident' }).click();
  await pause(1200);
  const boxes = pg.locator('main').getByRole('checkbox');
  for (let i = 0; i < 3; i++) { await boxes.nth(i).click(); await pause(550); }
  await pg.getByRole('button', { name: 'Open IOC extractor' }).click();
  await pause(400);
  await pg.getByText('Try sample').click();
  await pause(700);
  await pg.getByRole('button', { name: 'Extract IOCs' }).click();
  await pause(1200);
  await pg.getByRole('button', { name: 'Append to Notes' }).click();
  await pause(500);
  const search = pg.locator('main').getByRole('button', { name: /^Copy search:/ }).first();
  await search.scrollIntoViewIfNeeded();
  await pause(700);
  await search.click();
  await pause(1000);
  await pg.locator('#quick-note').pressSequentially('3 users clicked; 1 submitted credentials', { delay: 30 });
  await pg.keyboard.press('Enter');
  await pause(800);
  await pg.getByRole('button', { name: /^Splunk/ }).click();
  await pause(1800);
  await pg.getByRole('button', { name: /^Timeline/ }).last().click();
  await pause(800);
  await pg.keyboard.press('Control+k');
  await pause(300);
  await pg.getByRole('textbox', { name: 'Command' }).pressSequentially('export', { delay: 60 });
  await pause(900);
  await pg.keyboard.press('Escape');
  await pause(500);
  const video = pg.video();
  await ctx.close();
  renameSync(await video.path(), join(OUT, 'demo.webm'));
  rmSync(join(OUT, 'video-tmp'), { recursive: true, force: true });
}

await browser.close();
console.log(`Marketing assets written to site/assets/:\n  ${readdirSync(OUT).join('\n  ')}`);
