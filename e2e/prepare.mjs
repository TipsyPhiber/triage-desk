#!/usr/bin/env node
// Build both app variants against a throwaway license keypair and mint a Pro
// key for the browser tests. Never touches src/license/publicKey.js or your
// real signing key.

import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ed from '@noble/ed25519';
import { bytesToHex, signLicense } from '../src/license/license.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, 'e2e/.tmp');

const secret = ed.utils.randomSecretKey();
const publicKeyHex = bytesToHex(ed.getPublicKey(secret));
const token = signLicense({
  lid: 'L-E2E',
  name: 'Example Co.',
  email: 'soc@example.com',
  seats: 1,
  issued: new Date().toISOString().slice(0, 10),
}, secret);

const connectedToken = signLicense({
  lid: 'L-E2E-CONNECTED',
  name: 'Example Co.',
  email: 'soc@example.com',
  plan: 'connected',
  seats: 1,
  issued: new Date().toISOString().slice(0, 10),
}, secret);

mkdirSync(TMP, { recursive: true });
writeFileSync(join(TMP, 'license.txt'), token);
writeFileSync(join(TMP, 'license-connected.txt'), connectedToken);

const env = { ...process.env, TRIAGE_DESK_E2E_PUBLIC_KEY: publicKeyHex };
for (const mode of ['e2e', 'e2e-single', 'e2e-connected']) {
  execSync(`npx vite build --mode ${mode} --logLevel warn`, { cwd: ROOT, env, stdio: 'inherit' });
}
console.log('e2e builds ready');
