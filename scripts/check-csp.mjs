#!/usr/bin/env node
// Assert a built HTML file's Content-Security-Policy connect-src.
//   node scripts/check-csp.mjs <file> offline|connected
import { readFileSync } from 'node:fs';

const [file, edition] = process.argv.slice(2);
const csp = readFileSync(file, 'utf8').match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1];
if (!csp) { console.error(`${file}: no CSP meta tag`); process.exit(1); }
const connect = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith('connect-src')) || '';
const open = /\bhttps?:/.test(connect);
if (edition === 'offline' && open) { console.error(`${file}: offline build allows network (${connect})`); process.exit(1); }
if (edition === 'connected' && !open) { console.error(`${file}: connected build cannot reach Splunk (${connect})`); process.exit(1); }
console.log(`${file}: ${connect}`);
