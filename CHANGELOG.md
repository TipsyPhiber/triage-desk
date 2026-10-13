# Changelog

## Unreleased

### Added
- CI on Windows and Linux: unit tests, builds, browser tests (Chromium, Firefox, WebKit, plus Edge on Windows), seller tooling, release packaging, and the WASM build.
- Playwright browser tests (`npm run test:e2e`) covering the full customer flow and hostile input on both distributions.
- `.gitattributes` to keep line endings consistent across platforms.

### Changed
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
