#!/usr/bin/env node
// Build a self-contained live demo: the single-file app with Pro unlocked by
// a throwaway key and a realistic workspace pre-loaded on first open.
//
//   npm run build:demo   →   dist-demo/triage-desk-demo.html
//
// Host it next to the landing page as "Try the live demo". It is not the
// product: never ship it to customers, and never sell its key.

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoWorkspace } from './demo-workspace.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
execSync('node e2e/prepare.mjs', { cwd: ROOT, stdio: 'inherit' });

const license = readFileSync(join(ROOT, 'e2e/.tmp/license.txt'), 'utf8').trim();
const BASE = Date.UTC(2026, 0, 1);
const data = JSON.stringify(demoWorkspace(BASE, license)).replace(/</g, '\\u003c');

// Seed only an empty browser, shifting every timestamp so the active
// incidents read as "in progress right now".
const seed = `(function(){try{var K="triage-desk-workspace-v2";if(localStorage.getItem(K))return;var w=${data};var d=Date.now()-${BASE};w.incidents.forEach(function(i){["createdAt","startTime","endTime"].forEach(function(k){if(typeof i[k]==="number")i[k]+=d});i.events.forEach(function(e){e.ts+=d});Object.keys(i.checkedAt||{}).forEach(function(p){i.checkedAt[p]=i.checkedAt[p].map(function(t){return typeof t==="number"?t+d:t})})});localStorage.setItem(K,JSON.stringify(w))}catch(e){}})();`;

let html = readFileSync(join(ROOT, 'dist-e2e-single/triage-desk.html'), 'utf8');
const hash = `'sha256-${createHash('sha256').update(seed).digest('base64')}'`;
html = html.replace(/script-src /, `script-src ${hash} `);
html = html.replace('<script type="module"', `<script>${seed}</script>\n<script type="module"`);
html = html.replace('<title>', '<title>Live demo · ');

const out = join(ROOT, 'dist-demo');
mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'triage-desk-demo.html'), html);
console.log('Demo written to dist-demo/triage-desk-demo.html');
