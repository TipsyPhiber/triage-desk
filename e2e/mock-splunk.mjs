#!/usr/bin/env node
// Minimal Splunk stand-in for browser tests: server info, search export,
// and HTTP Event Collector, with the CORS headers a real Splunk sends when
// crossOriginSharingPolicy allows the app's origin.

import { createServer } from 'node:http';

const port = Number(process.argv[2] || 4210);
const TOKEN = 'test-token';
const HEC_TOKEN = 'hec-token';
let received = [];

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
}

function body(req) {
  return new Promise((ok) => { let b = ''; req.on('data', (c) => { b += c; }); req.on('end', () => ok(b)); });
}

createServer(async (req, res) => {
  cors(res);
  const url = new URL(req.url, `http://localhost:${port}`);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (url.pathname === '/__health') { res.end('ok'); return; }
  if (url.pathname === '/__received') { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(received)); return; }
  if (url.pathname === '/__reset') { received = []; res.end('ok'); return; }

  const auth = req.headers.authorization || '';
  if (url.pathname === '/services/server/info') {
    if (auth !== `Bearer ${TOKEN}`) { res.writeHead(401); res.end('unauthorized'); return; }
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ entry: [{ content: { serverName: 'mock-splunk', version: '9.3.0' } }] }));
    return;
  }
  if (url.pathname === '/services/search/v2/jobs/export' && req.method === 'POST') {
    if (auth !== `Bearer ${TOKEN}`) { res.writeHead(401); res.end('unauthorized'); return; }
    const params = new URLSearchParams(await body(req));
    const search = params.get('search') || '';
    const rows = search.includes('index=notable')
      ? [{ _time: '2026-10-14T09:12:44', rule_name: 'Brute force followed by success', urgency: 'critical', src: '198.51.100.23', dest: 'vpn-01', user: 'j.doe' }]
      : [
        { _time: '2026-10-14T09:00:00', src: '10.0.0.5', dest_ip: '203.0.113.77', count: '42' },
        { _time: '2026-10-14T09:05:00', src: '10.0.0.9', dest_ip: '203.0.113.78', count: '7' },
      ];
    res.setHeader('Content-Type', 'application/json');
    res.end(`${rows.map((r) => JSON.stringify({ preview: false, result: r })).join('\n')}\n`);
    return;
  }
  if (url.pathname === '/services/collector/event' && req.method === 'POST') {
    if (auth !== `Splunk ${HEC_TOKEN}`) { res.writeHead(403); res.end(JSON.stringify({ text: 'Invalid token', code: 4 })); return; }
    const text = await body(req);
    for (const line of text.split('\n')) if (line.trim()) received.push(JSON.parse(line));
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ text: 'Success', code: 0 }));
    return;
  }
  res.writeHead(404); res.end('not found');
}).listen(port, () => console.log(`mock splunk on ${port}`));
