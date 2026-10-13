import { describe, expect, it } from 'vitest';
import * as ed from '@noble/ed25519';
import { bytesToHex, signLicense, verifyLicense } from '../src/license/license.js';
import { canUsePlaybook, entitlementsFor } from '../src/license/entitlements.js';
import { BUILTIN_PLAYBOOKS } from '../src/playbooks/builtins.js';

const secret = ed.utils.randomSecretKey();
const publicKeyHex = bytesToHex(ed.getPublicKey(secret));
const base = { lid: 'L-1', name: 'Acme SOC', email: 'soc@acme.test', seats: 3, issued: '2026-10-01' };
const NOW = Date.parse('2026-10-13T00:00:00Z');

describe('license keys', () => {
  it('round-trips a valid key', () => {
    const token = signLicense(base, secret);
    const res = verifyLicense(token, { publicKeyHex, now: NOW });
    expect(res.status).toBe('valid');
    expect(res.license).toMatchObject({ name: 'Acme SOC', seats: 3, plan: 'pro' });
  });

  it('rejects a key signed by a different keypair', () => {
    const forged = signLicense(base, ed.utils.randomSecretKey());
    expect(verifyLicense(forged, { publicKeyHex, now: NOW }).status).toBe('invalid');
  });

  it('rejects a tampered payload', () => {
    const [p, body, sig] = signLicense(base, secret).split('.');
    const json = JSON.parse(Buffer.from(body, 'base64url').toString());
    json.seats = 500;
    const evil = `${p}.${Buffer.from(JSON.stringify(json)).toString('base64url')}.${sig}`;
    expect(verifyLicense(evil, { publicKeyHex, now: NOW }).status).toBe('invalid');
  });

  it('rejects garbage without throwing', () => {
    for (const junk of ['nope', 'TD1..', 'TD1.!!!.???', 'TD1.e30.' + 'A'.repeat(86), 'TD2.a.b']) {
      expect(verifyLicense(junk, { publicKeyHex, now: NOW }).status).toBe('invalid');
    }
  });

  it('reports none / unconfigured', () => {
    expect(verifyLicense('', { publicKeyHex }).status).toBe('none');
    expect(verifyLicense(signLicense(base, secret), { publicKeyHex: '' }).status).toBe('unconfigured');
  });

  it('enforces hard expiry', () => {
    const token = signLicense({ ...base, expires: '2026-10-12' }, secret);
    expect(verifyLicense(token, { publicKeyHex, now: NOW }).status).toBe('expired');
  });

  it('honors updatesUntil against the build date', () => {
    const token = signLicense({ ...base, updatesUntil: '2026-12-31' }, secret);
    expect(verifyLicense(token, { publicKeyHex, now: NOW, buildDate: '2026-12-31' }).status).toBe('valid');
    expect(verifyLicense(token, { publicKeyHex, now: NOW, buildDate: '2027-01-01' }).status).toBe('not-covered');
  });
});

describe('entitlements', () => {
  it('gates pro playbooks and incident count', () => {
    const free = entitlementsFor({ status: 'none' });
    const pro = entitlementsFor({ status: 'valid' });
    expect(free.incidentLimit).toBe(1);
    expect(pro.incidentLimit).toBe(Infinity);
    const general = BUILTIN_PLAYBOOKS.find((p) => p.tier === 'free');
    const ransomware = BUILTIN_PLAYBOOKS.find((p) => p.id === 'builtin-ransomware');
    expect(canUsePlaybook(general, free)).toBe(true);
    expect(canUsePlaybook(ransomware, free)).toBe(false);
    expect(canUsePlaybook(ransomware, pro)).toBe(true);
    expect(canUsePlaybook({ builtIn: false }, free)).toBe(false);
  });

  it('does not grant pro for an expired or uncovered key', () => {
    expect(entitlementsFor({ status: 'expired' }).pro).toBe(false);
    expect(entitlementsFor({ status: 'not-covered' }).pro).toBe(false);
  });
});
