# Changelog

## 1.1.0 — 2026-10-14

### Added
- **520 scenario playbooks in 22 categories**, plus the 5 essentials: ransomware, phishing, BEC, Active Directory, cloud identity, AWS, Azure, Google Cloud, SaaS, endpoint malware, web apps, edge-device exploitation, data exfiltration, insider threat, DDoS, Kubernetes, supply chain, CI/CD, OT/ICS, mobile, consumer fraud, and privacy/compliance. Every one is hand-written with tasks for all six phases, ATT&CK mappings, and Splunk searches. A quality gate (`npm run library:check`) rejects filler, duplicates, and near-copies.
- **Playbook finder.** Describe what's happening in plain words or search by ATT&CK ID, filter by category, and preview the plan before starting.
- **"What's happening?" start screen** that suggests playbooks as you type.
- **Command palette** (Ctrl/⌘+K) for every action, incident, phase, and playbook.
- **Splunk tools in every edition:** per-phase SPL with fill-in values, IOC hunting searches, alert/notable/CSV import (**I**), IOC lookup CSV and HEC timeline exports.
- **Triage Desk Connected:** a separate build that runs searches in your Splunk, pulls notable events, and sends the timeline to HEC. Needs a `connected` license (`license:issue -- --plan connected`). See `docs/SPLUNK.md`.
- Light theme (new default) with dark and system modes.
- Browser tests for the Splunk flows, including Connected against a mock Splunk server.
- CI on Windows and Linux: unit tests, builds, browser tests (Chromium, Firefox, WebKit, plus Edge on Windows), seller tooling, release packaging, and the WASM build.
- Playwright browser tests (`npm run test:e2e`) covering the full customer flow and hostile input on both distributions.
- `.gitattributes` to keep line endings consistent across platforms.

### Changed
- Fresh light design across the app.
- Release zip now includes the Connected edition under `connected/`.
- `npm run build:wasm` is now a Node script and works on Windows.
- `npm run release` creates the zip with PowerShell on Windows.

## 1.0.0 — 2026-10-13

First commercial release.

### Added
- Multi-incident workspace with incident switcher.
- Playbook library: General Incident (Free), Ransomware, Phishing & Credential Theft, Business Email Compromise, Cloud Credential Exposure (Pro).
- Custom playbook editor with JSON import/export (Pro). Incidents snapshot their playbook so edits never disturb in-flight incidents.
- Markdown and print-ready HTML/PDF reports with organization branding (Pro).
- TLP 2.0 marking per incident, on every report format.
- Workspace backup / restore.
- Offline Ed25519 license keys with seats, "updates until", and expiry; seller CLI (`license:keygen`, `license:issue`, `license:verify`).
- Single-file build (`triage-desk.html`) for offline / air-gapped use; `npm run release` packager.
- Strict Content-Security-Policy on all builds; zero network access.
- Warning banner when browser storage writes fail.
- Unit test suite.

### Changed
- Storage moved to `triage-desk-workspace-v2`; v0.x data is migrated automatically and the old key is left untouched.
- Resolving an incident now moves straight to Lessons Learned.

### Fixed
- Timeline events were logged from inside a React state updater and could be duplicated under StrictMode.
