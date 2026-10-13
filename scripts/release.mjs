#!/usr/bin/env node
// Build a customer-ready release into release/triage-desk-v<version>/:
//
//   triage-desk.html     single-file app (double-click to run, air-gap friendly)
//   web/                 static build for hosting on an internal web server
//   EULA.md, CUSTOMER-README.md
//
// Refuses to run if the license public key isn't configured, since such a
// build could never unlock Pro.

import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const run = (cmd) => execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

if (process.env.TRIAGE_DESK_E2E_PUBLIC_KEY) {
  console.error('error: TRIAGE_DESK_E2E_PUBLIC_KEY is set. Unset it before building a release.');
  process.exit(1);
}
const pub = readFileSync(join(ROOT, 'src/license/publicKey.js'), 'utf8').match(/LICENSE_PUBLIC_KEY_HEX = '([0-9a-f]*)'/)?.[1];
if (!pub || pub.length !== 64) {
  console.error('error: no license public key configured. Run "npm run license:keygen" first.');
  process.exit(1);
}
const config = readFileSync(join(ROOT, 'src/config.js'), 'utf8');
if (/PURCHASE_URL = ''/.test(config)) console.warn('warning: PURCHASE_URL is empty in src/config.js — the app will have no "Buy Pro" button.');
if (/SUPPORT_EMAIL = ''/.test(config)) console.warn('warning: SUPPORT_EMAIL is empty in src/config.js.');

run('npm test');
run('npm run build');
run('npm run build:single');

const out = join(ROOT, 'release', `triage-desk-v${pkg.version}`);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(ROOT, 'dist-single/triage-desk.html'), join(out, 'triage-desk.html'));
cpSync(join(ROOT, 'dist'), join(out, 'web'), { recursive: true });
for (const f of ['EULA.md', 'docs/CUSTOMER-README.md']) {
  if (existsSync(join(ROOT, f))) cpSync(join(ROOT, f), join(out, f.split('/').pop()));
}

const name = `triage-desk-v${pkg.version}`;
const zipCmd = process.platform === 'win32'
  // Windows has no `zip`, but every supported version ships PowerShell.
  ? `powershell -NoProfile -NonInteractive -Command "Compress-Archive -Path '${name}' -DestinationPath '${name}.zip' -Force"`
  : `zip -qr ${name}.zip ${name}`;
try {
  rmSync(join(ROOT, 'release', `${name}.zip`), { force: true });
  execSync(zipCmd, { cwd: join(ROOT, 'release'), stdio: 'pipe' });
  console.log(`\nRelease ready: release/${name}.zip`);
} catch {
  console.log(`\nRelease ready: release/${name}/ (couldn't create a zip; compress the folder yourself)`);
}
