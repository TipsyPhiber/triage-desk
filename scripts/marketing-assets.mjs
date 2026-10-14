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
import * as I from '../src/state/incident.js';
import { BUILTIN_PLAYBOOKS } from '../src/playbooks/builtins.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'site/assets');
const pb = (id) => BUILTIN_PLAYBOOKS.find((p) => p.id === `builtin-${id}`);
const MIN = 60_000;

execSync('node e2e/prepare.mjs', { cwd: ROOT, stdio: 'inherit' });
const LICENSE = readFileSync(join(ROOT, 'e2e/.tmp/license.txt'), 'utf8').trim();
const APP = pathToFileURL(join(ROOT, 'dist-e2e-single/triage-desk.html')).href;

// ---------------------------------------------------------------------------
// Demo data, built with the same pure operations the app uses.

function checkAll(inc, phase, idxs, t0, stepMin) {
  idxs.forEach((idx, k) => { inc = I.toggleCheck(inc, phase, idx, t0 + k * stepMin * MIN); });
  return inc;
}

function demoWorkspace(now) {
  // Active critical ransomware incident — the hero shot.
  let r = I.createIncident({ playbook: pb('ransomware'), name: 'INC-2026-0147 · Ransomware on FS-01 file server', severity: 'High', tlp: 'TLP:RED', now: now - 60 * MIN, id: 'inc-demo-ransomware' });
  let t = now - 52 * MIN;
  r = I.declareIncident(r, t);
  r = I.setSeverity(r, 'Critical', t + 2 * MIN);
  r = checkAll(r, 'identification', [0, 1, 2, 3, 4, 5, 6], t + 3 * MIN, 3);
  r = I.addQuickNote(r, 'identification', 'Ransom note README_RESTORE.txt on \\\\FS-01\\finance; extension .lockd', t + 4 * MIN);
  r = I.recordIocs(r, 'identification', [
    { kind: 'IPv4', value: '203.0.113.47' }, { kind: 'IPv4', value: '198.51.100.23' },
    { kind: 'Domain', value: 'update-cdn.example' }, { kind: 'Domain', value: 'files-sync.example' },
    { kind: 'SHA256', value: '9f2c4b8e1d7a6035c2e4f1b9a8d7c6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9' },
    { kind: 'Email', value: 'recovery@protonmail.example' },
  ], t + 12 * MIN);
  r = I.setNote(r, 'identification', [
    '[14:02] Detection: EDR alert "mass file rename" on FS-01 (Defender ATP)',
    '[14:05] Patient zero: WS-FIN-07 via RDP from 203.0.113.47',
    '[14:09] Exfil suspected: rclone.exe to files-sync.example (38 GB)',
    '[14:15] Backups: Veeam repo intact, last good restore point 02:00',
  ].join('\n'));
  r = I.setActivePhase(r, 'containment', t + 24 * MIN);
  r = checkAll(r, 'containment', [0, 1, 2], t + 26 * MIN, 5);
  r = I.addQuickNote(r, 'containment', 'Backup VLAN isolated; Veeam service account disabled', t + 31 * MIN);
  r = I.addQuickNote(r, 'containment', 'Legal + cyber insurer notified (policy #CY-4471)', t + 40 * MIN);

  // Second active incident.
  let p = I.createIncident({ playbook: pb('phishing'), name: 'INC-2026-0146 · Finance phishing → credential theft', severity: 'High', tlp: 'TLP:AMBER', now: now - 140 * MIN, id: 'inc-demo-phish' });
  p = I.declareIncident(p, now - 133 * MIN);
  p = checkAll(p, 'identification', [0, 1, 2, 3, 4, 5], now - 130 * MIN, 6);
  p = I.setActivePhase(p, 'containment', now - 90 * MIN);
  p = checkAll(p, 'containment', [0, 1, 2, 3], now - 85 * MIN, 8);
  p = I.setActivePhase(p, 'eradication', now - 50 * MIN);
  p = checkAll(p, 'eradication', [0], now - 45 * MIN, 5);

  // Resolved BEC incident.
  let b = I.createIncident({ playbook: pb('bec'), name: 'INC-2026-0139 · Vendor BEC — wire recall', severity: 'Medium', tlp: 'TLP:AMBER', now: now - 3 * 24 * 60 * MIN, id: 'inc-demo-bec' });
  const bt = now - 3 * 24 * 60 * MIN;
  b = I.declareIncident(b, bt);
  for (const phase of ['identification', 'containment', 'eradication', 'recovery']) {
    b = I.setActivePhase(b, phase, bt + MIN);
    b = checkAll(b, phase, b.tasks[phase].map((_, i) => i), bt + 10 * MIN, 9);
  }
  b = I.resolveIncident(b, bt + 342 * MIN);

  // Standby drill.
  const d = I.createIncident({ playbook: pb('cloud-credentials'), name: 'Tabletop · cloud access key leak drill', severity: 'Low', tlp: 'TLP:GREEN', now: now - 10 * MIN, id: 'inc-demo-drill' });

  return {
    version: 2,
    incidents: [d, b, p, r],
    activeIncidentId: r.id,
    customPlaybooks: [],
    settings: { orgName: 'Example Co. Security Operations', preparedBy: 'J. Rivera, Incident Commander', defaultTlp: 'TLP:AMBER' },
    license: LICENSE,
  };
}

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
    const ws = JSON.stringify(demoWorkspace(Date.now()));
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
