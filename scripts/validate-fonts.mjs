#!/usr/bin/env node
// JP font-coverage gate. Re-derives the character set the app's content needs
// (same collector vendor-fonts.mjs subsets to) and asserts every character is
// covered by the bundled Noto subset (recorded in fonts/jp-coverage.json).
//
// If the coverage file doesn't exist yet, this PASSES with a warning so the
// build still works before fonts are vendored. Once it exists, any drift — new
// content with a glyph outside the subset — FAILS the build, pointing you at
// `npm run vendor:fonts`. (Without this the missing glyph would silently fall
// back to the system font and faux-bold on device.)
//
// Run: node scripts/validate-fonts.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { collectJpChars } from './lib/jp-chars.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const COVERAGE = join(ROOT, 'fonts', 'jp-coverage.json');

function main() {
  if (!existsSync(COVERAGE)) {
    console.warn('[validate-fonts] no fonts/jp-coverage.json yet — run `npm run vendor:fonts`. Skipping.');
    return;
  }
  const covered = new Set(JSON.parse(readFileSync(COVERAGE, 'utf8')));
  const need = collectJpChars(ROOT);
  const missing = [];
  for (const ch of need) if (!covered.has(ch.codePointAt(0))) missing.push(ch);

  if (missing.length) {
    console.error(`[validate-fonts] ${missing.length} content character(s) are NOT in the bundled JP subset:`);
    console.error('   ' + missing.slice(0, 80).join(' ') + (missing.length > 80 ? ' …' : ''));
    console.error('   → run `npm run vendor:fonts` to re-subset Noto to the current content.');
    process.exit(1);
  }
  console.log(`[validate-fonts] OK — JP subset covers all ${need.size} content characters.`);
}

main();
