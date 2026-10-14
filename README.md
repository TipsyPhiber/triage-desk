# Triage Desk

An offline incident response workspace for SOC analysts and on-call engineers. Walk every incident through the six NIST SP 800-61 phases (**Preparation → Identification → Containment → Eradication → Recovery → Lessons Learned**) with lifecycle-aware checklists, an auto-recorded timeline, IOC extraction, and reports you can hand to leadership.

It ships with **525 hand-written scenario playbooks** (ransomware to Kubernetes to OT), each with ATT&CK mappings and ready-to-run **Splunk** searches. Analysts describe what's happening in plain words and get the closest plan.

Nothing leaves the machine. No accounts, no telemetry, no server. Triage Desk ships as a single HTML file that runs from disk, even on an air-gapped analyst workstation, and a strict Content-Security-Policy forbids every outbound connection. The separate **Connected** edition can also talk to the customer's own Splunk (search, notables, HEC); see [`docs/SPLUNK.md`](docs/SPLUNK.md).

> **Selling Triage Desk?** See [`docs/SELLING.md`](docs/SELLING.md) for the launch runbook: keypair setup, issuing license keys, building a release, and storefront setup.

## Editions

| | Free | Pro | Connected |
| --- | :-: | :-: | :-: |
| Six-phase lifecycle with phase locking | ✓ | ✓ | ✓ |
| Auto-recorded incident timeline | ✓ | ✓ | ✓ |
| Rust/WASM IOC extractor (refangs `hxxp`, `[.]`, `[at]`) | ✓ | ✓ | ✓ |
| TLP 2.0 markings, plain-text report, backup / restore | ✓ | ✓ | ✓ |
| Playbook finder, command palette, light/dark themes | ✓ | ✓ | ✓ |
| Splunk alert import, IOC hunting SPL, lookup + HEC exports | ✓ | ✓ | ✓ |
| General Incident playbook | ✓ | ✓ | ✓ |
| Incidents in workspace | 1 | Unlimited | Unlimited |
| 520 scenario playbooks with Splunk searches | Browse | ✓ | ✓ |
| Custom playbooks + JSON import/export | | ✓ | ✓ |
| Markdown and print-ready HTML/PDF reports with org branding | | ✓ | ✓ |
| Run searches, pull notables, send timeline to Splunk | | | ✓ |
| Network access | none | none | your Splunk only |

Connected is a separate build (`npm run build:connected`) and needs a license issued with `--plan connected`.

Backup/restore is deliberately free: customers' incident data is never held hostage. If a Pro license lapses, existing incidents stay fully readable and editable; only new Pro actions are gated.

## Features

- **Multi-incident workspace.** Run several incidents side by side and switch between them from the sidebar.
- **Playbook library.** Five built-in playbooks. Duplicate any of them to tailor it, or write your own, one task per line. Each incident snapshots its playbook when it's created, so editing a playbook never disturbs an incident in flight.
- **Lifecycle gating.** Preparation and Lessons Learned lock while an incident is active, and response phases lock after it's resolved (PICERL / NIST SP 800-61).
- **Timeline.** Every check, phase change, severity change, quick note, and IOC extraction is timestamped while the incident clock runs.
- **IOC extractor.** Paste logs or phishing emails to pull IPs, domains, URLs, MD5/SHA1/SHA256 hashes, emails, and CVEs. Results feed a per-incident IOC index that shows which phase each indicator surfaced in.
- **Reports.** Text, Markdown, or a standalone HTML report you can print to PDF. All three carry TLP marking, severity, timings, checklist state, notes, IOC index, and timeline.
- **Hardened against hostile input.** Analysts paste attacker-controlled text all day. Imports and persisted state are validated. The HTML report escapes everything and carries its own `default-src 'none'` CSP. The Markdown report fences notes and wraps IOCs in code spans.

## Stack

- React 18, Vite 6, Tailwind CSS v4
- Rust → WASM IOC extractor (`crates/ioc-extractor`)
- Ed25519 offline license verification via [`@noble/ed25519`](https://github.com/paulmillr/noble-ed25519)
- Vitest

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm test` | Unit tests (licensing, state, migration, reports) |
| `npm run test:e2e` | Browser tests against both distributions (add `-- --project=chromium` to pick one browser) |
| `npm run build` | Static build to `dist/` (for hosting on an internal web server) |
| `npm run build:single` | One self-contained `dist-single/triage-desk.html` |
| `npm run build:connected` | Connected edition: `dist-connected/` and `dist-connected-single/triage-desk-connected.html` |
| `npm run library:check` | Validate the scenario playbook library (see [`docs/PLAYBOOK-SPEC.md`](docs/PLAYBOOK-SPEC.md)) |
| `npm run build:wasm` | Rebuild the IOC extractor (needs Rust + [`wasm-pack`](https://rustwasm.github.io/wasm-pack/installer/)) |
| `npm run license:keygen` | Create your license signing keypair (one time) |
| `npm run license:issue -- --name … --email …` | Mint a license key |
| `npm run license:verify -- TD1.…` | Check a license key |
| `npm run build:demo` | Live demo (`dist-demo/triage-desk-demo.html`): Pro unlocked with a throwaway key and example incidents pre-loaded. For your website only, never for customers |
| `npm run marketing:assets` | Regenerate the landing page screenshots and demo video in `site/assets/` from the real app |
| `npm run release` | Test, build both variants, and package `release/triage-desk-v<version>.zip` |

Developer builds have no public key, so Pro can't be unlocked until you run `license:keygen`. That's intentional: `npm run release` refuses to package a build without a key.

## Platform support

Triage Desk is a web page, so it runs wherever a current browser does: Windows, Linux, and macOS.

CI (`.github/workflows/ci.yml`) runs on **Windows and Linux** on every push. It runs the unit tests, both builds, browser tests in **Chromium, Firefox, and WebKit (plus Microsoft Edge on Windows)** against both the single file and the hosted build, the seller license tools, release packaging, and the WASM build.

The seller tooling is plain Node.js (22+) and works on Windows, Linux, and macOS. On Windows, `npm run release` zips with PowerShell's `Compress-Archive`, and the signing key goes in `%USERPROFILE%\.triage-desk\`, protected by your user profile's permissions rather than Unix file modes.

Browser tests need Playwright's browsers once: `npx playwright install chromium firefox webkit`.

## Project layout

```
src/
  App.jsx                 composition + workspace state
  config.js               storefront URL, support email
  data.js                 fixed phase definitions, severities, TLP levels
  playbooks/builtins.js   the five essential playbooks
  playbooks/library/      520 scenario playbooks, one JSON file per category
  playbooks/library.js    loads the library; validateLibrary.js is its quality gate
  license/
    license.js            key format, sign/verify
    entitlements.js       Free vs Pro rules
    publicKey.js          your Ed25519 public key (written by license:keygen)
  state/
    incident.js           pure incident operations + validation
    workspace.js          storage, v1 migration, backup format
    playbooks.js          playbook validation, import/export
    iocIndex.js           IOC merge + cross-phase aggregate
  lib/
    exportReport.js       text / Markdown / HTML report renderers
    playbookSearch.js     plain-language playbook search
    splunk.js             offline Splunk tools: SPL, alert import, CSV/HEC export
    splunkClient.js       Connected edition: REST search + HEC
    theme.js              light / dark / system
    phaseActivity.js      lifecycle gating rules
  components/             UI
scripts/
  license.mjs             seller license CLI
  release.mjs             release packager
  build-wasm.mjs          cross-platform WASM rebuild
e2e/                      Playwright browser tests
tests/                    Vitest suites
site/index.html           marketing landing page (assets/ generated by marketing:assets)
```

## Storage

The workspace is stored in `localStorage` under `triage-desk-workspace-v2`. Data from v0.x (`triage-desk-state-v1`) is migrated automatically on first load and left in place, so a downgrade loses nothing. If the browser refuses a write (quota or disabled storage), a red banner warns the user to export a backup.

## License

Proprietary. See [`EULA.md`](EULA.md).
