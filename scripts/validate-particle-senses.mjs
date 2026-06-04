#!/usr/bin/env node
// validate-particle-senses.mjs
// ---------------------------------------------------------------------------
// Audits tokenized story content for homograph particle-sense mismatches and
// gates new ones. Homograph particles (でも = "but" vs "even", と, から, …) are
// untagged in token data and resolved at render by surface; this linter applies
// the SAME context-aware resolver the renderer uses (app/shared/particle-sense.js)
// to catch occurrences that would render the wrong sense.
//
//   FAIL  — a token carries an explicit `g` that contradicts the resolver.
//   WARN  — a hazard surface with no resolver rule yet (resolves blindly to the
//           first-match sense). Reported as an inventory for review, not a failure.
//
// Tokenized prose lives in stories/audiostories; lessons/grammar/reviews
// reference terms by explicit id (not surface), so they aren't affected.
// ---------------------------------------------------------------------------
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── Load the shared resolver (single source of truth) via a window shim ──────
const senseSrc = fs.readFileSync(path.join(ROOT, 'app/shared/particle-sense.js'), 'utf8');
const shimWindow = {};
new Function('window', 'module', senseSrc)(shimWindow, undefined);
const PS = shimWindow.JPShared.particleSense;

// ── First-match sense per surface (what context-blind lookup shows today) ────
const particles = JSON.parse(fs.readFileSync(path.join(ROOT, 'shared/particles.json'), 'utf8')).particles;
const firstMatch = new Map();   // surface -> {id, role}
const sensesBySurface = new Map(); // surface -> [{id, role}]
for (const p of particles) {
  const s = p.particle;
  if (!s) continue;
  if (!firstMatch.has(s)) firstMatch.set(s, { id: p.id, role: p.role });
  if (!sensesBySurface.has(s)) sensesBySurface.set(s, []);
  sensesBySurface.get(s).push({ id: p.id, role: p.role });
}

// ── Collect tokenized files ──────────────────────────────────────────────────
function findFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const fp = path.join(dir, e.name);
      if (e.isDirectory()) walk(fp);
      else if (e.name === 'story.json' || e.name === 'audiostory.json') out.push(fp);
    }
  };
  walk(path.join(ROOT, 'data'));
  return out.sort();
}

const ENDERS = new Set(['。', '！', '？', '!', '?', '」', '』', '\n']);
const fails = [];
const inventory = new Map(); // surface -> { count, byExpected:Map, samples:[], hasRule }

function note(surface, expectedId, sample) {
  if (!inventory.has(surface)) inventory.set(surface, { count: 0, byExpected: new Map(), samples: [], hasRule: PS.hasRule(surface) });
  const inv = inventory.get(surface);
  inv.count++;
  const key = expectedId || ('first-match:' + (firstMatch.get(surface) || {}).id);
  inv.byExpected.set(key, (inv.byExpected.get(key) || 0) + 1);
  if (inv.samples.length < 3 && sample) inv.samples.push(sample);
}

for (const fp of findFiles()) {
  const rel = path.relative(ROOT, fp);
  const data = JSON.parse(fs.readFileSync(fp, 'utf8'));
  for (const para of (data.paragraphs || [])) {
    const toks = para.tokens;
    if (!Array.isArray(toks)) continue;
    toks.forEach((t, i) => {
      const k = t && t.k;
      if (!k || !PS.isHazard(k)) return;
      const prevK = i > 0 ? (toks[i - 1].k || '') : '';
      const nextK = i + 1 < toks.length ? (toks[i + 1].k || '') : '';
      const atSentenceStart = i === 0 || ENDERS.has(prevK);
      const expectedId = PS.resolveParticleSense(k, { prevK, nextK, atSentenceStart });
      note(k, expectedId, para.jp);
      // Baked contradiction: an explicit g that disagrees with the resolver.
      if (t.g && expectedId && t.g !== expectedId) {
        fails.push(`${rel}: "${k}" tagged g="${t.g}" but resolver expects "${expectedId}" — in: ${para.jp}`);
      }
    });
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
console.log('[validate-particle-senses] homograph particle audit');
const surfaces = [...inventory.keys()].sort((a, b) => inventory.get(b).count - inventory.get(a).count);
for (const s of surfaces) {
  const inv = inventory.get(s);
  const tag = inv.hasRule ? 'resolved' : 'UNHANDLED → first-match: ' + (firstMatch.get(s) || {}).id;
  const dist = [...inv.byExpected.entries()].map(([k, n]) => `${k}×${n}`).join(', ');
  console.log(`  ${s}  (${inv.count} occurrence(s)) [${tag}]`);
  console.log(`     senses in particles.json: ${(sensesBySurface.get(s) || []).map(x => x.id).join(', ')}`);
  console.log(`     distribution: ${dist}`);
  if (!inv.hasRule) inv.samples.forEach(x => console.log(`     e.g. ${x}`));
}

const unhandled = surfaces.filter(s => !inventory.get(s).hasRule);
if (unhandled.length) {
  console.log(`\n  ⚠ ${unhandled.length} hazard surface(s) have no resolver rule yet (shown above) — they render the first-match sense regardless of context. Add rules in app/shared/particle-sense.js as needed.`);
}

if (fails.length) {
  console.error(`\n  ✗ ${fails.length} baked sense contradiction(s):`);
  fails.forEach(f => console.error('    ' + f));
  process.exit(1);
}
console.log('\n  ✓ no baked sense contradictions.');
