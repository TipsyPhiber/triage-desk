#!/usr/bin/env node
// Rebuild the Rust IOC extractor into src/wasm/ioc-extractor. Requires
// wasm-pack (https://rustwasm.github.io/wasm-pack/). Cross-platform
// replacement for the old `cd … && wasm-pack … && rm -f …` shell one-liner.

import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'src/wasm/ioc-extractor');

const res = spawnSync(
  'wasm-pack',
  ['build', '--target', 'web', '--out-dir', OUT, '--release'],
  { cwd: join(ROOT, 'crates/ioc-extractor'), stdio: 'inherit', shell: process.platform === 'win32' },
);
if (res.error?.code === 'ENOENT') {
  console.error('error: wasm-pack not found. Install it from https://rustwasm.github.io/wasm-pack/installer/');
  process.exit(1);
}
if (res.status !== 0) process.exit(res.status ?? 1);

// wasm-pack writes a .gitignore that would hide the generated files from git.
rmSync(join(OUT, '.gitignore'), { force: true });
console.log(`WASM written to ${OUT}`);
