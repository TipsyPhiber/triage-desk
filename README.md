# Triage Desk

A lightweight incident response playbook app for walking through IR phases, tracking tasks, and exporting incident reports. Built for SOC analysts and on-call engineers who need a structured, no-nonsense workspace during an incident.

Aligned with the six-phase model from NIST SP 800-61: **Preparation → Identification → Containment → Eradication → Recovery → Lessons Learned**.

## Features

- **Sidebar navigation** through all six IR phases, with live per-phase progress
- **Pre-filled checklists** of realistic tasks for each phase (isolate hosts, rotate creds, capture IOCs, etc.)
- **Live incident timer** — click *Declare Incident* to start; persists across phases until you mark it resolved
- **Per-phase notes** for IOCs, decisions, timestamps, and observations
- **Severity selector** (Low / Medium / High / Critical) that color-codes the entire UI
- **Export Report** — downloads a plain-text incident summary with timeline, severity, progress, every checklist item, notes, and a deduped IOC index showing which phase each indicator surfaced in
- **Dark SOC-dashboard theme** — built with Tailwind, no chrome you don't need
- **Browser-persisted** — incident state (timer, checks, notes, timeline, IOCs) auto-saves to `localStorage` so a refresh or accidental tab close doesn't lose work. Use *Reset* to clear.

## Stack

- React 18 (hooks only)
- Vite 6
- Tailwind CSS v4 (via `@tailwindcss/vite`)

## Getting started

```bash
npm install
npm run dev
```

Then open http://localhost:5173/.

## Scripts

| Command          | What it does                          |
| ---------------- | ------------------------------------- |
| `npm run dev`     | Start the Vite dev server             |
| `npm run build`   | Build a production bundle to `dist/`  |
| `npm run preview` | Serve the production build locally    |

## Project layout

```
src/
  App.jsx                       // composition + state orchestration
  data.js                       // phase definitions, tasks, severity color tokens
  iocLoader.js                  // lazy WASM init for the IOC extractor
  main.jsx                      // React entry
  index.css                     // Tailwind import
  lib/
    time.js                     // formatElapsed
    exportReport.js             // buildReport (pure) + downloadReport
  state/
    persistence.js              // localStorage load/save/reconcile
    eventId.js                  // monotonic event id sequence
    iocIndex.js                 // per-phase merge + cross-phase aggregate
  styles/
    eventStyles.js              // timeline + IOC kind color tokens
  components/
    Sidebar.jsx
    TopBar.jsx
    PhaseView.jsx
    IocExtractor.jsx
    TimelineDrawer.jsx
```

## Notes

- State persists to `localStorage` under the key `triage-desk-state-v1`. Clearing site data or hitting *Reset* wipes it.
- The exported `.txt` filename uses the incident name and an ISO timestamp, e.g. `inc-2026-04-phishing-2026-05-03T17-22-08-123Z.txt`.
- Severity affects only color theming, not behavior — pick whatever helps you and your team read the room.
