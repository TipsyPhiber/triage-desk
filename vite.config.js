import { createHash } from 'node:crypto';
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
// Builds are stamped with their date so "updates until" licenses can tell
// which releases they cover. Override with BUILD_DATE=YYYY-MM-DD for
// reproducible builds.
const BUILD_DATE = process.env.BUILD_DATE || new Date().toISOString().slice(0, 10);

// Inject a strict Content-Security-Policy into the built HTML. Triage Desk
// never needs the network, so the policy forbids every outbound connection;
// that's both a defense against XSS via pasted attacker content and a
// verifiable "nothing leaves the machine" claim for customers.
function cspPlugin({ singleFile, connected, outDir, fileName }) {
  return {
    name: 'triage-desk-csp',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      const file = join(outDir, 'index.html');
      let html = readFileSync(file, 'utf8');
      let scriptSrc = "'self'";
      if (singleFile) {
        // Everything is inlined, so allow exactly these scripts by hash.
        const hashes = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
          .map((m) => m[1])
          .filter((body) => body.length > 0)
          .map((body) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`);
        scriptSrc = hashes.join(' ');
      }
      const policy = [
        "default-src 'none'",
        `script-src ${scriptSrc} 'wasm-unsafe-eval'`,
        singleFile ? "style-src 'unsafe-inline'" : "style-src 'self'",
        "img-src 'self' data:",
        "font-src 'self' data:",
        // WASM is fetched from same origin (hosted) or a data: URL (single
        // file). The Connected edition may also reach the analyst's Splunk
        // REST API and HTTP Event Collector, which can live on any host.
        `connect-src ${singleFile ? 'data:' : "'self'"}${connected ? ' https: http://localhost:* http://127.0.0.1:*' : ''}`,
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; ');
      html = html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
      writeFileSync(file, html);
      if (singleFile) renameSync(file, join(outDir, fileName));
    },
  };
}

// End-to-end test builds ('e2e', 'e2e-single') verify licenses against a
// throwaway key passed in TRIAGE_DESK_E2E_PUBLIC_KEY, so tests can activate
// Pro without touching the real signing key. Only these modes read it, and
// they write to their own output folders so they can't be mistaken for a
// release build.
//
// Connected-edition modes ('connected', 'connected-single', 'e2e-connected')
// relax connect-src so the app can talk to a customer's Splunk.
const E2E_MODES = new Set(['e2e', 'e2e-single', 'e2e-connected']);
const MODES = new Set(['production', 'development', 'test', 'single', 'connected', 'connected-single', ...E2E_MODES]);

export default defineConfig(({ mode }) => {
  if (!MODES.has(mode)) throw new Error(`unknown build mode "${mode}"`);
  const singleFile = mode.endsWith('single');
  const connected = mode.includes('connected');
  const e2e = E2E_MODES.has(mode);
  const e2eKey = e2e ? (process.env.TRIAGE_DESK_E2E_PUBLIC_KEY || '') : '';
  if (e2e && !/^[0-9a-f]{64}$/.test(e2eKey)) {
    throw new Error(`mode "${mode}" requires TRIAGE_DESK_E2E_PUBLIC_KEY (64 hex chars)`);
  }
  const outDir = resolve(e2e || connected ? `dist-${mode}` : (singleFile ? 'dist-single' : 'dist'));
  const fileName = connected ? 'triage-desk-connected.html' : 'triage-desk.html';
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(singleFile ? [viteSingleFile({ removeViteModuleLoader: true })] : []),
      cspPlugin({ singleFile, connected, outDir, fileName }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_DATE__: JSON.stringify(BUILD_DATE),
      __E2E_PUBLIC_KEY__: JSON.stringify(e2eKey),
      __EDITION__: JSON.stringify(connected ? 'connected' : 'offline'),
    },
    base: './',
    build: {
      outDir,
      emptyOutDir: true,
      ...(singleFile ? { assetsInlineLimit: Number.MAX_SAFE_INTEGER } : {}),
    },
    test: {
      environment: 'node',
      include: ['tests/**/*.test.js'],
    },
  };
});
