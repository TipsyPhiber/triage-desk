# Triage Desk — Getting Started

Thanks for downloading Triage Desk.

## Run it

**Single file (recommended):** open `triage-desk.html` in Chrome, Edge, Firefox, or Safari. That's it — no install, no internet connection required. Copy it to an air-gapped workstation if you like.

**Hosted:** copy the `web/` folder to any static web server (nginx, IIS, S3 + CloudFront, an internal wiki host). It's all static files; no backend.

## Supported platforms

Windows, Linux, and macOS, in current versions of Chrome, Edge, Firefox, or Safari. Nothing to install, and no admin rights needed.

## Activate Pro

Open **Settings & license → License**, paste the `TD1.…` key from your purchase email, and click **Activate**. Keys are verified offline — nothing is sent anywhere.

## Your data

Incidents, playbooks, and settings are saved in your browser's local storage on this machine only.

- **Export a backup regularly** from **Settings & license → Data**, and always before closing out an incident or clearing browser data.
- Private / incognito windows don't keep data after they close.
- Backups contain incident notes and your license key — handle them according to the incident's TLP marking.
- When running the single file, keep it at the same path: some browsers tie storage to the file's location.

## Quick tour

1. **Start an incident** and pick a playbook.
2. **Declare Incident** starts the clock and jumps to Identification. From here every check, phase change, severity change, and quick note is timestamped on the **Timeline**.
3. Paste alerts or emails into the **IOC Extractor** to pull indicators into your notes and the report's IOC index.
4. **Mark Resolved** stops the clock and opens Lessons Learned.
5. **Export Report** — text, Markdown, or printable HTML (open it and print to PDF).

## Support

Reply to your purchase email, or use the support address shown in **Settings & license → License**.
