#!/usr/bin/env node
/**
 * scripts/migrate-stories-to-json.mjs
 *
 * One-shot converter: each story's `story.md` + `terms.json` → `story.json`.
 *
 * Idempotent — skips stories that already have story.json, unless --force is
 * passed. Old MD/terms files are NOT deleted (kept as reference).
 *
 * Per-story output schema is documented in:
 *   /Users/joel/.claude/plans/we-are-building-the-melodic-reddy.md
 *
 * Run:
 *   node scripts/migrate-stories-to-json.mjs               # all stories, skip existing
 *   node scripts/migrate-stories-to-json.mjs --force       # overwrite existing
 *   node scripts/migrate-stories-to-json.mjs --only=my-family   # single story
 */

import { readFile, writeFile, readdir, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { tokenizeText, buildGlossaryIndex, reconstructFromTokens } from './lib/tokenize.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const SCHEMA_VERSION = '2.0.0';

const args = new Set(process.argv.slice(2).filter(a => a.startsWith('--')));
const force = args.has('--force');
const onlyArg = process.argv.slice(2).find(a => a.startsWith('--only='));
const onlySlug = onlyArg ? onlyArg.split('=')[1] : null;

// ── Section parser ──────────────────────────────────────────────────────────

// Split markdown on `### ...` headers. Returns { sectionTitle → bodyLines[] }.
function splitSections(md) {
  const sections = {};
  let current = null;
  const lines = md.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^###\s+(.+?)\s*$/);
    if (m) {
      current = m[1].trim();
      sections[current] = [];
    } else if (current) {
      sections[current].push(line);
    }
  }
  return sections;
}

// Locate a section by case-insensitive header keyword.
function findSection(sections, keyword) {
  const re = new RegExp(keyword, 'i');
  const key = Object.keys(sections).find(k => re.test(k));
  return key ? sections[key].join('\n') : '';
}

// Strip a block of prose into paragraphs. Drops the trailing おわり / The End
// line, code fences, hr lines, and empty paragraphs.
function paragraphsFromProse(text) {
  const cleaned = text
    .replace(/^\s*---\s*$/gm, '')
    .split(/\n{2,}/)
    .map(p => p.replace(/^\s+|\s+$/g, ''))
    .filter(Boolean)
    // Drop おわり markers and "The End"
    .filter(p => !/^\*\*\s*(?:おわり|The End)\s*\*\*$/i.test(p))
    // Strip a leading bold title like **My Family**
    .filter(p => !/^\*\*[^*]+\*\*$/.test(p));
  return cleaned;
}

// ── Vocab / Grammar bullet parser ───────────────────────────────────────────
//
// Lines look like:
//   - 父 (ちち) - father (own)
//   - こんにちは - hello / good afternoon
//   - します (する) - to do / to play
//   - かぞく (家族) - family
//
// We extract (primarySurface, parentheticalSurface) and try to resolve either
// against the glossary by surface OR reading. Returns array of glossary ids.

function parseBulletList(text) {
  const items = [];
  for (const raw of text.split('\n')) {
    const m = raw.match(/^\s*-\s+(.+?)\s*(?:\(([^)]+)\))?\s*(?:[-—]\s*.+)?\s*$/);
    if (!m) continue;
    const primary = m[1].trim();
    const paren   = (m[2] || '').trim();
    if (!primary) continue;
    items.push({ primary, paren });
  }
  return items;
}

function resolveBulletsToIds(bullets, glossaryIndex) {
  const ids = [];
  const seen = new Set();
  for (const b of bullets) {
    // Try primary surface match first.
    let entry = glossaryIndex.get(b.primary);
    // Then parenthetical (often the kanji form for kana-led bullets).
    if (!entry && b.paren) entry = glossaryIndex.get(b.paren);
    // Last resort: scan for reading match (rare).
    if (!entry) {
      for (const [, e] of glossaryIndex) {
        if (e && e.reading === b.primary) { entry = e; break; }
      }
    }
    if (entry && entry.id) {
      // Synthetic inflected entries point back to their root via original_id.
      // Always cite the root in vocabUsed/grammarUsed so validator can verify
      // the id exists in a glossary file.
      const id = entry.original_id || entry.id;
      if (!seen.has(id)) { seen.add(id); ids.push(id); }
    }
  }
  return ids;
}

// ── Manifest helpers ────────────────────────────────────────────────────────

async function loadManifest() {
  const raw = await readFile(path.join(ROOT, 'manifest.json'), 'utf8');
  return JSON.parse(raw);
}

// Return [{slug, dir, manifestEntry, level, category}] for every story.
function listStoryTargets(manifest) {
  const targets = [];
  const data = manifest.data || {};
  for (const level of Object.keys(data)) {
    const stories = (data[level] && data[level].stories) || [];
    for (const s of stories) {
      const category = level === 'custom' ? 'custom' : 'curriculum';
      const slug = s.id || path.basename(s.dir);
      targets.push({ slug, dir: s.dir, manifestEntry: s, level: category === 'custom' ? null : level, category });
    }
  }
  return targets;
}

// ── Main per-story migration ────────────────────────────────────────────────

async function migrateStory(target, glossaryIndex) {
  const { slug, dir, manifestEntry, level, category } = target;
  const dirAbs = path.join(ROOT, dir);
  const mdPath = path.join(dirAbs, 'story.md');
  const termsPath = path.join(dirAbs, 'terms.json');
  const outPath = path.join(dirAbs, 'story.json');

  if (existsSync(outPath) && !force) {
    return { slug, skipped: true, reason: 'story.json exists (use --force to overwrite)' };
  }
  if (!existsSync(mdPath)) {
    return { slug, skipped: true, reason: 'no story.md found' };
  }

  const md = await readFile(mdPath, 'utf8');

  // Parse title from the first two H1/H2 lines.
  const titleMatch = md.match(/^#\s+(.+?)\s*$/m);
  const englishTitleMatch = md.match(/^##\s+(.+?)\s*$/m);
  const title = (titleMatch ? titleMatch[1] : (manifestEntry.titleJp || '')).trim();
  const englishTitle = (englishTitleMatch ? englishTitleMatch[1] : (manifestEntry.title || '')).trim();

  // Section split (header-based).
  const sections = splitSections(md);
  const storyText = findSection(sections, 'Story Text|Japanese');
  const englishText = findSection(sections, 'English Translation');
  const vocabText = findSection(sections, 'Vocabulary');
  const grammarText = findSection(sections, 'Grammar Points');

  // Fallback: many N4 stories put the JA prose directly after the H2 title,
  // with no `### Story Text` header — it's just the block before
  // `### English Translation`. Recover it by slicing the raw MD on that header.
  let storyTextResolved = storyText;
  if (!storyTextResolved && englishText) {
    const idx = md.search(/^###\s+English Translation\s*$/im);
    if (idx >= 0) {
      // Strip the title (# / ##), strip any leading hr lines, take everything up to the EN header.
      storyTextResolved = md.slice(0, idx)
        .replace(/^#[^\n]*\n/, '')
        .replace(/^##[^\n]*\n/, '');
    }
  }

  const jaParagraphs = paragraphsFromProse(storyTextResolved);
  const enParagraphs = paragraphsFromProse(englishText);

  // Pair JA ⇄ EN by sequence. Tolerate mismatch.
  const warnings = [];
  if (jaParagraphs.length !== enParagraphs.length) {
    warnings.push(`paragraph count mismatch: ja=${jaParagraphs.length}, en=${enParagraphs.length}`);
  }

  const paragraphs = jaParagraphs.map((jp, i) => {
    // Simple greedy glossary tokenization. Multi-char surfaces match longest-
    // first. Unmatched runs become bare tokens. No morphological analysis,
    // no compound-context inference — just what the glossary already knows.
    // Edge cases that the glossary doesn't cover stay bare (no wrong reading
    // gets introduced). Improving coverage = adding entries to the glossary.
    const tokens = tokenizeText(jp, glossaryIndex);
    const reconstructed = reconstructFromTokens(tokens);
    if (reconstructed !== jp) {
      warnings.push(`paragraph ${i + 1}: tokens reconstruct mismatch — got "${reconstructed}" vs jp "${jp}"`);
    }
    return {
      jp,
      en: enParagraphs[i] || '',
      tokens
    };
  });

  const vocabBullets = parseBulletList(vocabText);
  const grammarBullets = parseBulletList(grammarText);
  const vocabUsed = resolveBulletsToIds(vocabBullets, glossaryIndex);
  const grammarUsed = resolveBulletsToIds(grammarBullets, glossaryIndex);
  if (vocabBullets.length && vocabUsed.length < vocabBullets.length) {
    warnings.push(`vocab: ${vocabBullets.length - vocabUsed.length} of ${vocabBullets.length} bullets unresolved`);
  }
  if (grammarBullets.length && grammarUsed.length < grammarBullets.length) {
    warnings.push(`grammar: ${grammarBullets.length - grammarUsed.length} of ${grammarBullets.length} bullets unresolved`);
  }

  const out = {
    schemaVersion: SCHEMA_VERSION,
    id: slug,
    title,
    englishTitle,
    category,
    level,
    unlocksAfter: manifestEntry.unlocksAfter || null,
    paragraphs,
    vocabUsed,
    grammarUsed,
    comprehension: {
      intro: 'Did you follow the story?',
      questions: []   // hand-author per story
    }
  };

  await writeFile(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  return { slug, written: true, paragraphs: paragraphs.length, vocab: vocabUsed.length, grammar: grammarUsed.length, warnings };
}

// ── Main ────────────────────────────────────────────────────────────────────

const manifest = await loadManifest();
const targets = listStoryTargets(manifest)
  .filter(t => !onlySlug || t.slug === onlySlug);

console.log(`Migrating ${targets.length} story${targets.length === 1 ? '' : 'ies'}…`);

const conjugationRules = JSON.parse(await readFile(path.join(ROOT, 'conjugation_rules.json'), 'utf8'));
const glossaryIndex = await buildGlossaryIndex(
  [
    path.join(ROOT, 'data/N5/glossary.N5.json'),
    path.join(ROOT, 'data/N4/glossary.N4.json'),
    path.join(ROOT, 'data/N3/glossary.N3.json'),
    path.join(ROOT, 'shared/particles.json'),
    path.join(ROOT, 'shared/characters.json')
  ],
  readFile,
  { includeReadings: true, conjugationRules, verbose: true }
);
console.log(`Indexed ${glossaryIndex.size} surfaces (incl. readings + characters + inflections).`);

let written = 0, skipped = 0;
for (const t of targets) {
  try {
    const r = await migrateStory(t, glossaryIndex);
    if (r.skipped) {
      skipped++;
      console.log(`  [skip] ${t.slug}: ${r.reason}`);
    } else {
      written++;
      console.log(`  [ok]   ${t.slug}: ${r.paragraphs} paragraphs, ${r.vocab} vocab, ${r.grammar} grammar`);
      for (const w of (r.warnings || [])) console.log(`         ⚠ ${w}`);
    }
  } catch (err) {
    console.error(`  [err]  ${t.slug}: ${err.message}`);
  }
}

console.log(`\nDone. ${written} written, ${skipped} skipped.`);
