# Triage Desk — Copy Deck

Ready-to-use drafts. Replace `[brackets]`. Keep claims inside `POSITIONING.md`'s proof points.

---

## Show HN

**Title:** Show HN: Triage Desk – an offline incident response workspace in one HTML file

**Body:**

> I built Triage Desk because every incident I've worked ran on a mix of a PDF plan, a chat channel, and a scratch file, and afterwards nobody could say exactly when we knew what.
>
> It's a single ~600 KB HTML file. You open it, pick a playbook (general NIST 800-61, ransomware, phishing, BEC, cloud key exposure, or your own), and declare the incident. From then on every task you check, phase change, severity change, and note is stamped T+ from declaration. At the end you export a TLP-marked report.
>
> Some implementation details HN might find interesting:
>
> - **No network, enforced.** The build injects a CSP with `default-src 'none'` and `connect-src data:`; inline scripts are allowed by SHA-256 hash only. The e2e suite fails if the page makes any request.
> - **IOC extraction** is a small Rust crate compiled to WASM. It refangs `hxxps://` and `1.2.3[.]4` and dedupes across the incident.
> - **Offline licensing**: Pro keys are Ed25519-signed JSON verified in the browser with @noble/ed25519. There's no license server. Yes, you can patch it out; it's there to keep honest customers honest.
> - **Hostile input**: analysts paste attacker-controlled text all day, so exported HTML reports escape everything and carry their own `default-src 'none'` policy.
> - Data lives in localStorage, with one-click JSON backup.
>
> The free edition does one incident at a time with the general playbook. Pro ($59 once) adds unlimited incidents, the scenario playbooks, custom playbooks, and Markdown/PDF reports.
>
> I'd love feedback from people who run incidents, especially on the playbook content.
>
> [link]

---

## Reddit (r/blueteamsec, r/cybersecurity)

Check each subreddit's self-promotion rules before posting. Lead with the free stuff.

**Title:** I made a free printable ransomware first-hour checklist, and the offline IR tool it came from

> The checklist is TLP:CLEAR, no signup: [checklist link]
>
> It comes from the ransomware playbook in Triage Desk, an offline incident response workspace I've been building. It's a single HTML file (no install, no account, no network access; it runs air-gapped), with NIST 800-61 phases, an automatic T+ timeline, an IOC extractor that handles defanged indicators, and TLP-marked reports.
>
> The free edition is fully usable for one incident at a time: [link]
>
> What would you add to the checklist? I'm especially unsure about [specific item, e.g. when to reset krbtgt].

---

## LinkedIn

> At 3 a.m., during an incident, nobody opens the IR plan PDF.
>
> They open a chat channel and a scratch file. Then, the next morning, legal and the insurer ask "when did we first know?" and nobody can answer precisely.
>
> I built Triage Desk to fix that:
> → A playbook for every NIST 800-61 phase: ransomware, phishing, BEC, cloud key exposure, or your own
> → A timeline that records itself: every action stamped T+ from declaration
> → IOC extraction from logs and phishing emails, even defanged
> → A TLP-marked report, ready when you resolve
>
> It's one HTML file. No account, no cloud, no telemetry. It runs on an air-gapped analyst laptop.
>
> Free edition here: [link]
>
> If you run incidents or tabletops, I'd genuinely value your feedback on the playbooks.

---

## Mastodon / Bluesky (thread)

1. I built an incident response workspace that never touches the network. One HTML file, strict CSP (`default-src 'none'`), runs air-gapped. [link] 🧵
2. Pick a playbook (ransomware, phishing, BEC, cloud key leak), hit Declare, and every action lands on a T+ timeline. "When did we know?" finally has an exact answer.
3. Paste logs or a phishing email → Rust/WASM extracts IPs, domains, URLs, hashes, CVEs, refanging `hxxps://` and `[.]`. One click copies a blocklist.
4. Resolve → export a TLP-marked report as text, Markdown, or print-to-PDF.
5. Free for one incident at a time. Pro is $59 once, with no subscription and no license server (offline Ed25519 keys).

---

## Product Hunt

- **Tagline (60 chars):** Offline incident response workspace in a single HTML file
- **Description:** Run security incidents with NIST 800-61 playbooks, an automatic T+ timeline, IOC extraction, and TLP-marked reports. No account, no cloud, no telemetry: Triage Desk is one HTML file that runs air-gapped.
- **First comment:** use the Show HN body, shortened.

---

## Store listing (Lemon Squeezy / Gumroad / Paddle)

**Product name:** Triage Desk Pro

**Short description:** The offline incident response workspace. One-time purchase, 12 months of updates.

**Long description:**

> Triage Desk turns your incident response plan into a workspace your team actually uses at 3 a.m.
>
> **What you get with Pro**
> - Unlimited incidents, side by side
> - Scenario playbooks: Ransomware, Phishing & Credential Theft, Business Email Compromise, Cloud Credential Exposure
> - Custom playbooks with JSON import/export
> - Branded Markdown and print-ready PDF reports with TLP marking
> - 12 months of updates; the license never expires
>
> **Included in every edition**
> - Six-phase NIST SP 800-61 lifecycle with phase locking
> - Automatic T+ incident timeline
> - IOC extractor (IPs, domains, URLs, hashes, emails, CVEs; handles defanged input)
> - Full workspace backup and restore
>
> **Private by design.** Triage Desk is a single HTML file. No account, no telemetry, no server. A strict Content-Security-Policy blocks every network request. It runs on Windows, macOS, and Linux, including air-gapped machines.
>
> After purchase you'll receive a license key by email. Paste it into Settings & license → License. Activation happens offline.

**Team variant:** same, plus "Up to 10 analysts. Host internally on any static web server. Priority email support."

---

## Emails

### License delivery (send per sale)

**Subject:** Your Triage Desk Pro license

> Hi [first name],
>
> Thanks for buying Triage Desk Pro. Here's your license key:
>
> ```
> [TD1.… key]
> ```
>
> **To activate:** open `triage-desk.html`, go to **Settings & license → License**, paste the key, and click **Activate**. It works offline.
>
> **Two things worth doing today:**
> 1. Set your organization name under **Settings → Reports** so it appears on exported reports.
> 2. Export a backup (**Settings → Data**) after each incident. Your data lives only in your browser.
>
> License ID: [L-…] · Seats: [n] · Updates until: [date]
>
> Reply to this email any time. It comes straight to me.
>
> [Your name]

### Day 7 check-in (buyers only)

**Subject:** Quick question about Triage Desk

> Hi [first name], it's been a week since you picked up Triage Desk. One question: **what's the one thing that would make it more useful during your next incident?** Just hit reply; I read every answer.
>
> [Your name]

### Update renewal (send ~2 weeks before `updatesUntil`)

**Subject:** Your Triage Desk updates year ends on [date]

> Hi [first name],
>
> Your Triage Desk license keeps working forever. Your included updates end on [date].
>
> Since you bought it we've shipped: [2–4 concrete improvements].
>
> If you'd like another year of updates, renewal is [$24] here: [link]. If not, keep using the version you have; nothing will stop working.
>
> [Your name]

### Beta invite

**Subject:** Free Triage Desk Pro for your feedback?

> Hi [name], I'm launching Triage Desk, an offline incident response workspace (one HTML file, no cloud). Would you try Pro free for 60 days on your next incident or tabletop, and give me 20 minutes of honest feedback? If yes, I'll send a key.

---

## Founding story (blog post outline)

1. The incident where nobody could answer "when did we know?"
2. Why the existing options didn't fit: PDF plans aren't used, SOAR is heavy and cloud-hosted, and spreadsheets don't keep time.
3. The design constraint: incident data must never leave the responder's machine.
4. How that shaped the build: one file, strict CSP, WASM extractor, offline keys.
5. What's next, and an ask for feedback.
