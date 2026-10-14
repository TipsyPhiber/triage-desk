#!/usr/bin/env node
// Seller-side license tooling. Never ship or commit the private key.
//
//   npm run license:keygen                      # one time: create signing keypair
//   npm run license:issue -- --name "Acme SOC" --email soc@acme.test --seats 5 --updates-until 2027-10-13
//   npm run license:verify -- TD1.xxxx.yyyy
//
// The private key defaults to ~/.triage-desk/license-signing.key and can be
// overridden with --key <path> or TRIAGE_DESK_SIGNING_KEY=<path>.

import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ed from '@noble/ed25519';
import { bytesToHex, hexToBytes, signLicense, verifyLicense } from '../src/license/license.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC_KEY_FILE = join(ROOT, 'src/license/publicKey.js');

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) out[k] = true;
      else { out[k] = next; i++; }
    } else out._.push(a);
  }
  return out;
}

function die(msg) {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function keyPath(args) {
  return resolve(args.key || process.env.TRIAGE_DESK_SIGNING_KEY || join(homedir(), '.triage-desk', 'license-signing.key'));
}

function readSecret(args) {
  const p = keyPath(args);
  if (!existsSync(p)) die(`no signing key at ${p} — run "npm run license:keygen" first`);
  return hexToBytes(readFileSync(p, 'utf8').trim());
}

function readPublicKeyHex() {
  const src = readFileSync(PUBLIC_KEY_FILE, 'utf8');
  return src.match(/LICENSE_PUBLIC_KEY_HEX = '([0-9a-f]*)'/)?.[1] ?? '';
}

function writePublicKey(hex) {
  const src = readFileSync(PUBLIC_KEY_FILE, 'utf8');
  writeFileSync(PUBLIC_KEY_FILE, src.replace(/LICENSE_PUBLIC_KEY_HEX = '[0-9a-f]*'/, `LICENSE_PUBLIC_KEY_HEX = '${hex}'`));
}

function keygen(args) {
  const p = keyPath(args);
  if (existsSync(p) && !args.force) {
    die(`${p} already exists. Replacing it invalidates every license you've issued; pass --force if you really mean it.`);
  }
  const secret = randomBytes(32);
  const pub = bytesToHex(ed.getPublicKey(secret));
  mkdirSync(dirname(p), { recursive: true, mode: 0o700 });
  writeFileSync(p, bytesToHex(secret) + '\n', { mode: 0o600 });
  chmodSync(p, 0o600);
  writePublicKey(pub);
  console.log(`Private signing key written to ${p} (mode 600). BACK THIS UP somewhere safe and offline.`);
  console.log(`Public key ${pub} written to src/license/publicKey.js — commit that file.`);
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function issue(args) {
  if (!args.name || args.name === true) die('--name is required');
  if (!args.email || args.email === true) die('--email is required');
  const seats = args.seats ? Number(args.seats) : 1;
  if (!Number.isInteger(seats) || seats < 1) die('--seats must be a positive integer');
  const plan = args.plan ? String(args.plan) : 'pro';
  if (!['pro', 'connected'].includes(plan)) die('--plan must be "pro" or "connected"');
  for (const k of ['updates-until', 'expires']) {
    if (args[k] && !DATE_RE.test(args[k])) die(`--${k} must be YYYY-MM-DD`);
  }
  const secret = readSecret(args);
  const pubHex = readPublicKeyHex();
  if (pubHex !== bytesToHex(ed.getPublicKey(secret))) {
    die('signing key does not match src/license/publicKey.js — keys issued now would be rejected by this build');
  }
  const lid = args.lid || `L-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomBytes(4).toString('hex')}`;
  const token = signLicense({
    lid,
    name: String(args.name),
    email: String(args.email),
    plan,
    seats,
    issued: new Date().toISOString().slice(0, 10),
    updatesUntil: args['updates-until'] || null,
    expires: args.expires || null,
  }, secret);
  if (args.json) {
    console.log(JSON.stringify({ lid, token }));
  } else {
    console.error(`Issued ${lid} to ${args.name} <${args.email}> (${plan}, ${seats} seat${seats === 1 ? '' : 's'})`);
    console.log(token);
  }
}

function verify(args) {
  const token = args._[0];
  if (!token) die('usage: license:verify <key>');
  const res = verifyLicense(token, { publicKeyHex: readPublicKeyHex() });
  console.log(JSON.stringify(res, null, 2));
  process.exit(res.status === 'valid' ? 0 : 2);
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._.shift();
if (cmd === 'keygen') keygen(args);
else if (cmd === 'issue') issue(args);
else if (cmd === 'verify') verify(args);
else die('usage: license.mjs <keygen|issue|verify> [options]');
