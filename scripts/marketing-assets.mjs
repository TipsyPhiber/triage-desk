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

async function page({ seed = true, video = false, width = 1600, height = 1000 } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: video ? 1 : 2,
    acceptDownloads: true,
    ...(video ? { recordVideo: { dir: join(OUT, 'video-tmp'), size: { width, height } } } : {}),
  });
  if (seed) {
    const ws = JSON.stringify(demoWorkspace(Date.now(), LICENSE));
    await ctx.addInitScript((data) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem('triage-desk-workspace-v2', data);
        sessionStorage.setItem('seeded', '1');
      }
    }, ws);
  }
  const pg = await ctx.newPage();
  pg.on('dialog', (d) => d.accept());
  await pg.goto(APP);
  return { ctx, pg };
}

const shot = (pg, name) => pg.screenshot({ path: join(OUT, `${name}.jpg`), type: 'jpeg', quality: 90 });

{
  const { ctx, pg } = await page();
  await pg.getByText('Backup VLAN isolated').first().waitFor().catch(() => {});
  await pg.waitForTimeout(600);
  await shot(pg, 'app-incident');

  await pg.getByRole('button', { name: /^IOCs/ }).click();
  await pg.waitForTimeout(300);
  await shot(pg, 'app-iocs');
  {
    // Focused crop for the landing page: top of the IOC panel.
    const box = await pg.locator('aside[aria-label="Incident intel"]').boundingBox();
    await pg.screenshot({ path: join(OUT, 'crop-iocs.jpg'), type: 'jpeg', quality: 90, clip: { x: box.x, y: box.y, width: box.width, height: 560 } });
  }
  await pg.getByRole('button', { name: /^Timeline/ }).last().click();

  await pg.locator('nav[aria-label="Phases"]').getByRole('button', { name: /Identification/ }).click();
  await pg.waitForTimeout(300);
  await shot(pg, 'app-identification');
  {
    // Checklist with completion times, cropped to the phase content.
    const box = await pg.locator('main').boundingBox();
    await pg.screenshot({ path: join(OUT, 'crop-checklist.jpg'), type: 'jpeg', quality: 90, clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 640) } });
  }

  await pg.getByRole('button', { name: /New incident/ }).click();
  await pg.waitForTimeout(300);
  await shot(pg, 'app-new-incident');
  await pg.getByRole('dialog').screenshot({ path: join(OUT, 'crop-new-incident.jpg'), type: 'jpeg', quality: 90 });
  await pg.keyboard.press('Escape');

  await pg.getByRole('button', { name: 'Playbooks' }).click();
  await pg.getByRole('button', { name: 'Ransomware', exact: true }).click();
  await pg.waitForTimeout(300);
  await shot(pg, 'app-playbooks');
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

{
  const { ctx, pg } = await page({ seed: false });
  await pg.getByText('Start an incident').waitFor();
  await pg.waitForTimeout(300);
  await shot(pg, 'app-welcome');
  await ctx.close();
}

// Demo video: a responder working a phishing incident from scratch.
{
  const { ctx, pg } = await page({ seed: false, video: true, width: 1600, height: 1000 });
  const pause = (ms) => pg.waitForTimeout(ms);
  await pg.getByText('Start an incident').waitFor();
  await pause(900);
  await pg.evaluate((key) => {
    const ws = { version: 2, incidents: [], activeIncidentId: null, customPlaybooks: [], settings: { orgName: 'Example Co. Security Operations', preparedBy: '', defaultTlp: 'TLP:AMBER' }, license: key };
    localStorage.setItem('triage-desk-workspace-v2', JSON.stringify(ws));
  }, LICENSE);
  await pg.reload();
  await pg.getByText('Start an incident').click();
  await pause(700);
  await pg.getByRole('dialog').getByPlaceholder(/INC-2026-0142/).pressSequentially('INC-2026-0148 · Payroll phishing', { delay: 35 });
  await pause(300);
  await pg.getByRole('button', { name: /^Phishing/ }).click();
  await pause(600);
  await pg.getByRole('button', { name: 'Create incident' }).click();
  await pause(700);
  await pg.getByRole('radio', { name: 'High' }).click();
  await pause(400);
  await pg.getByRole('button', { name: 'Declare Incident' }).click();
  await pause(1200);
  for (const t of ['Collect the original message', 'Extract sender, reply-to', 'Detonate URLs']) {
    await pg.getByText(t).click();
    await pause(550);
  }
  await pg.getByRole('button', { name: 'Open IOC extractor' }).click();
  await pause(400);
  await pg.getByText('Try sample').click();
  await pause(700);
  await pg.getByRole('button', { name: 'Extract IOCs' }).click();
  await pause(1400);
  await pg.getByRole('button', { name: 'Append to Notes' }).click();
  await pause(500);
  await pg.locator('#quick-note').pressSequentially('3 users clicked; 1 submitted credentials', { delay: 30 });
  await pg.keyboard.press('Enter');
  await pause(800);
  await pg.getByRole('button', { name: /^IOCs/ }).click();
  await pause(1500);
  await pg.getByRole('button', { name: /^Timeline/ }).last().click();
  await pause(600);
  await pg.keyboard.press('3');
  await pause(500);
  await pg.getByText('Purge the message from all mailboxes').click();
  await pause(450);
  await pg.getByText('Reset passwords and revoke sessions').click();
  await pause(900);
  await pg.getByRole('button', { name: /Export Report/ }).click();
  await pause(1300);
  await pg.keyboard.press('Escape');
  await pause(500);
  const video = pg.video();
  await ctx.close();
  renameSync(await video.path(), join(OUT, 'demo.webm'));
  rmSync(join(OUT, 'video-tmp'), { recursive: true, force: true });
}

await browser.close();
console.log(`Marketing assets written to site/assets/:\n  ${readdirSync(OUT).join('\n  ')}`);
