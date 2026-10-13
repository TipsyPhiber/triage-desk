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
function cspPlugin({ singleFile, outDir }) {
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
        // WASM is fetched from same origin (hosted) or a data: URL (single file).
        singleFile ? 'connect-src data:' : "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join('; ');
      html = html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${policy}" />`,
      );
      writeFileSync(file, html);
      if (singleFile) renameSync(file, join(outDir, 'triage-desk.html'));
    },
  };
}

export default defineConfig(({ mode }) => {
  const singleFile = mode === 'single';
  const outDir = resolve(singleFile ? 'dist-single' : 'dist');
  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(singleFile ? [viteSingleFile({ removeViteModuleLoader: true })] : []),
      cspPlugin({ singleFile, outDir }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __BUILD_DATE__: JSON.stringify(BUILD_DATE),
    },
    base: './',
    build: {
      outDir,
      emptyOutDir: true,
      ...(singleFile ? { assetsInlineLimit: Number.MAX_SAFE_INTEGER } : {}),
    },
    test: {
      environment: 'node',
    },
  };
});
