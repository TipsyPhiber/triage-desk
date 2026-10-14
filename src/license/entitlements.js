import { LICENSE_PUBLIC_KEY_HEX } from './publicKey.js';
import { verifyLicense } from './license.js';

// Free tier: one incident in the workspace, the General playbook, and
// plain-text reports. Backup/restore is always free — customers should never
// have their own incident data held hostage.
export const FREE_INCIDENT_LIMIT = 1;

/* global __BUILD_DATE__, __E2E_PUBLIC_KEY__, __EDITION__ */
export const BUILD_DATE = typeof __BUILD_DATE__ === 'string' ? __BUILD_DATE__ : null;

// Non-empty only in end-to-end test builds (see vite.config.js).
const E2E_PUBLIC_KEY = typeof __E2E_PUBLIC_KEY__ === 'string' ? __E2E_PUBLIC_KEY__ : '';

// 'offline' (no network at all) or 'connected' (may reach a Splunk
// instance the analyst configures). Fixed at build time; see vite.config.js.
export const EDITION = typeof __EDITION__ === 'string' ? __EDITION__ : 'offline';

export function entitlementsFor(licenseStatus) {
  const pro = licenseStatus?.status === 'valid';
  const plan = pro ? licenseStatus.license?.plan : null;
  return {
    pro,
    plan,
    // Live Splunk needs both the Connected build and a Connected license.
    connected: EDITION === 'connected' && plan === 'connected',
    incidentLimit: pro ? Infinity : FREE_INCIDENT_LIMIT,
    proPlaybooks: pro,
    customPlaybooks: pro,
    richReports: pro,
  };
}

export function checkLicense(token, now = Date.now()) {
  return verifyLicense(token, { publicKeyHex: E2E_PUBLIC_KEY || LICENSE_PUBLIC_KEY_HEX, now, buildDate: BUILD_DATE });
}

export function canUsePlaybook(playbook, ent) {
  if (!playbook) return false;
  if (!playbook.builtIn) return ent.customPlaybooks;
  return playbook.tier === 'free' || ent.proPlaybooks;
}
