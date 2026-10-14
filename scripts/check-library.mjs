#!/usr/bin/env node
// Validate the playbook library: node scripts/check-library.mjs [file…]
// With no arguments, checks every src/playbooks/library/*.json together.
import { readFileSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateLibrary } from '../src/playbooks/validateLibrary.js';

const DIR = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'src/playbooks/library');
const paths = process.argv.slice(2).length
  ? process.argv.slice(2).map((p) => resolve(p))
  : readdirSync(DIR).filter((f) => f.endsWith('.json')).sort().map((f) => join(DIR, f));

const files = [];
for (const p of paths) {
  try { files.push([basename(p), JSON.parse(readFileSync(p, 'utf8'))]); }
  catch (e) { console.error(`${basename(p)}: invalid JSON: ${e.message}`); process.exit(1); }
}
const { errors, count, categories } = validateLibrary(files);
if (errors.length) {
  console.error(errors.slice(0, 200).join('\n'));
  console.error(`\n${errors.length} problem(s).`);
  process.exit(1);
}
console.log(`OK: ${count} playbooks in ${categories} categories.`);
