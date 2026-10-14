// Offline license keys.
//
// A key is `TD1.<payload>.<signature>` where payload is base64url JSON and
// signature is an Ed25519 signature over the ASCII string `TD1.<payload>`.
// Verification needs only the public key, so it works fully air-gapped.
//
// Payload fields:
//   v            1
//   lid          license id (opaque, for your records / revocation lists)
//   name         licensee (person or organization)
//   email        purchaser email
//   plan         'pro'
//   seats        number of analysts covered
//   issued       YYYY-MM-DD
//   updatesUntil YYYY-MM-DD | null — perpetual license covering builds
//                released on or before this date (null = all versions)
//   expires      YYYY-MM-DD | null — hard expiry, for trials/subscriptions
//
// Client-side checks can always be patched out by a determined user; this is
// meant to keep honest customers honest, not to be DRM.

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';

ed.hashes.sha512 = sha512;

export const LICENSE_PREFIX = 'TD1';
const PLANS = new Set(['pro']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function b64urlEncode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  if (!/^[A-Za-z0-9_-]*$/.test(str)) throw new Error('bad base64url');
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function hexToBytes(hex) {
  if (typeof hex !== 'string' || !/^[0-9a-f]*$/i.test(hex) || hex.length % 2) throw new Error('bad hex');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

export function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const enc = new TextEncoder();
const dec = new TextDecoder();

function validDate(x) {
  return x === null || x === undefined || (typeof x === 'string' && DATE_RE.test(x));
}

function validPayload(p) {
  return p && typeof p === 'object'
    && p.v === 1
    && typeof p.lid === 'string' && p.lid
    && typeof p.name === 'string'
    && typeof p.email === 'string'
    && PLANS.has(p.plan)
    && Number.isInteger(p.seats) && p.seats > 0
    && typeof p.issued === 'string' && DATE_RE.test(p.issued)
    && validDate(p.updatesUntil)
    && validDate(p.expires);
}

// Seller side. `secretKey` is the 32-byte Ed25519 private key.
export function signLicense(payload, secretKey) {
  const full = { v: 1, plan: 'pro', seats: 1, updatesUntil: null, expires: null, ...payload };
  if (!validPayload(full)) throw new Error('Invalid license payload');
  const body = `${LICENSE_PREFIX}.${b64urlEncode(enc.encode(JSON.stringify(full)))}`;
  const sig = ed.sign(enc.encode(body), secretKey);
  return `${body}.${b64urlEncode(sig)}`;
}

function today(now) {
  return new Date(now).toISOString().slice(0, 10);
}

// Returns { status, license?, reason? } where status is one of:
//   none          no key entered
//   unconfigured  this build has no public key (developer build)
//   invalid       malformed or bad signature
//   expired       past `expires`
//   not-covered   build is newer than `updatesUntil`
//   valid
export function verifyLicense(token, { publicKeyHex, now = Date.now(), buildDate } = {}) {
  const key = typeof token === 'string' ? token.trim() : '';
  if (!key) return { status: 'none' };
  if (!publicKeyHex) return { status: 'unconfigured', reason: 'This build has no license public key configured.' };

  const parts = key.split('.');
  if (parts.length !== 3 || parts[0] !== LICENSE_PREFIX) {
    return { status: 'invalid', reason: 'That doesn\'t look like a Triage Desk license key.' };
  }

  let payload;
  try {
    const sig = b64urlDecode(parts[2]);
    const ok = sig.length === 64 && ed.verify(sig, enc.encode(`${parts[0]}.${parts[1]}`), hexToBytes(publicKeyHex));
    if (!ok) return { status: 'invalid', reason: 'License signature is not valid.' };
    payload = JSON.parse(dec.decode(b64urlDecode(parts[1])));
  } catch {
    return { status: 'invalid', reason: 'License key is corrupted. Paste it again exactly as delivered.' };
  }
  if (!validPayload(payload)) return { status: 'invalid', reason: 'License key payload is not recognized.' };

  const day = today(now);
  if (payload.expires && day > payload.expires) {
    return { status: 'expired', license: payload, reason: `License expired on ${payload.expires}.` };
  }
  if (payload.updatesUntil && buildDate && buildDate > payload.updatesUntil) {
    return {
      status: 'not-covered',
      license: payload,
      reason: `Your license covers releases up to ${payload.updatesUntil}; this build is from ${buildDate}. Renew for updates, or keep using an earlier build.`,
    };
  }
  return { status: 'valid', license: payload };
}
