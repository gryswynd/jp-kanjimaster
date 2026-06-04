#!/usr/bin/env node
/**
 * scripts/validate-manifest.mjs
 *
 * Integrity validator for the curriculum gating chain in manifest.json.
 * manifest.json is hand-authored and is the SINGLE source of truth for
 * `unlocksAfter` (the content JSON files deliberately do NOT carry it). A typo'd
 * or dangling unlocksAfter silently breaks progression, so this guards it.
 *
 * Exits 0 on success, 1 on any error. Used by:
 *   - npm run build:www  (prepended; blocks build on a broken chain)
 *   - pre-commit hook (when manifest.json is staged)
 *
 * Checks, across every lessons/grammar/reviews/stories entry in each level:
 *   - ids are unique (no two entries share an id)
 *   - every `unlocksAfter` points to an id that actually exists in the manifest
 *   - no cycles in the unlocksAfter chain (A→B→…→A)
 *   - WARN: an item gated behind a LATER level (e.g. an N5 item ← an N4 id)
 *
 * Run:
 *   node scripts/validate-manifest.mjs
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KINDS = ['lessons', 'grammar', 'reviews', 'stories'];
const LEVEL_ORDER = ['N5', 'N4'];

function fail(msg) { console.error('  ✗ ' + msg); }

const m = JSON.parse(await readFile(path.join(ROOT, 'manifest.json'), 'utf8'));
const data = m.data || {};

const errors = [];
const warnings = [];

// Build id → { level, kind, unlocksAfter } across everything.
const byId = new Map();
const dupes = [];
for (const lvl of Object.keys(data)) {
  for (const kind of KINDS) {
    for (const it of (data[lvl][kind] || [])) {
      if (!it || !it.id) continue;
      if (byId.has(it.id)) dupes.push(it.id);
      byId.set(it.id, { level: lvl, kind, unlocksAfter: it.unlocksAfter || null });
    }
  }
}

// 1. Duplicate ids.
for (const id of dupes) errors.push(`duplicate id: ${id}`);

// 2. Dangling unlocksAfter + later-level gate warnings.
for (const [id, info] of byId) {
  const prereq = info.unlocksAfter;
  if (!prereq) continue;
  const target = byId.get(prereq);
  if (!target) {
    errors.push(`${id} (${info.level}/${info.kind}) unlocksAfter="${prereq}" — no such id in manifest`);
    continue;
  }
  // Gated behind a later level? (e.g. an N5 item depending on an N4 id.) Only
  // meaningful between the ordered teaching levels — `custom` (custom stories) is
  // a content bucket, not a level, and legitimately gates behind real lessons.
  const bothOrdered = LEVEL_ORDER.includes(info.level) && LEVEL_ORDER.includes(target.level);
  if (bothOrdered && LEVEL_ORDER.indexOf(target.level) > LEVEL_ORDER.indexOf(info.level)) {
    warnings.push(`${id} (${info.level}) is gated behind ${prereq} (${target.level}) — a later level; likely unreachable in order`);
  }
}

// 3. Cycle detection over the unlocksAfter graph.
const WHITE = 0, GRAY = 1, BLACK = 2;
const color = new Map([...byId.keys()].map((id) => [id, WHITE]));
function visit(id, stack) {
  color.set(id, GRAY);
  stack.push(id);
  const prereq = byId.get(id)?.unlocksAfter;
  if (prereq && byId.has(prereq)) {
    const c = color.get(prereq);
    if (c === GRAY) {
      const from = stack.indexOf(prereq);
      errors.push(`cycle: ${stack.slice(from).concat(prereq).join(' → ')}`);
    } else if (c === WHITE) {
      visit(prereq, stack);
    }
  }
  stack.pop();
  color.set(id, BLACK);
}
for (const id of byId.keys()) if (color.get(id) === WHITE) visit(id, []);

// ── Report ──────────────────────────────────────────────────────────────────
if (warnings.length) {
  console.warn(`[validate-manifest] ${warnings.length} warning(s):`);
  warnings.forEach((w) => console.warn('  ⚠ ' + w));
}
if (errors.length) {
  console.error(`[validate-manifest] ${errors.length} error(s):`);
  errors.forEach(fail);
  process.exit(1);
}
console.log(`[validate-manifest] OK — ${byId.size} entries, all unlocksAfter resolve, no cycles.`);
