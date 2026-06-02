#!/usr/bin/env node
// TEMP audit: find conversations whose speaker labels don't auto-resolve to a
// character (so they need an explicit `speakers` map for headshots to show).
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const chars = JSON.parse(readFileSync('shared/characters.json', 'utf8')).characters;
const matchSet = new Set();
for (const c of chars) {
  [c.surface, c.reading, ...(c.matches || [])].forEach(m => { if (m) matchSet.add(m); });
}
const resolves = (spk) => matchSet.has(String(spk || ''));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (name.endsWith('.json')) out.push(p);
  }
  return out;
}

// A "conversation" = any object with a `lines` array whose entries have `spk`.
function* findConvos(node, file, path = '') {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) yield* findConvos(node[i], file, `${path}[${i}]`);
  } else if (node && typeof node === 'object') {
    if (Array.isArray(node.lines) && node.lines.some(l => l && typeof l === 'object' && 'spk' in l)) {
      yield { node, file, path };
    }
    for (const k of Object.keys(node)) {
      if (k === 'lines') continue;
      yield* findConvos(node[k], file, `${path}.${k}`);
    }
  }
}

const files = walk('data');
let total = 0, needFix = 0;
const report = [];
for (const file of files) {
  let json;
  try { json = JSON.parse(readFileSync(file, 'utf8')); } catch { continue; }
  for (const { node, path } of findConvos(json, file)) {
    total++;
    const spks = [...new Set(node.lines.map(l => String(l.spk ?? '')))];
    const hasMap = node.speakers && Object.keys(node.speakers).length;
    const unresolved = spks.filter(s => !resolves(s) && !(node.speakers && node.speakers[s]));
    if (unresolved.length === 0) continue;
    needFix++;
    report.push({
      file, path,
      title: node.title || node.context || '',
      hasMap: !!hasMap,
      spks,
      unresolved,
      // char ids referenced in line terms — clues for who's present
      chars: [...new Set(node.lines.flatMap(l =>
        (l.terms || []).map(t => (typeof t === 'string' ? t : t && t.id))
          .filter(x => x && String(x).startsWith('char_'))))],
    });
  }
}

// Group by file for readability
const byFile = {};
for (const r of report) (byFile[r.file] ||= []).push(r);

console.log(`Total conversations: ${total}`);
console.log(`Need speakers map:   ${needFix}\n`);
for (const file of Object.keys(byFile).sort()) {
  console.log(`\n### ${file}  (${byFile[file].length})`);
  for (const r of byFile[file]) {
    console.log(`  - ${r.path}  "${String(r.title).slice(0, 60)}"`);
    console.log(`      spks: [${r.spks.join(', ')}]   unresolved: [${r.unresolved.join(', ')}]`);
    console.log(`      chars-in-terms: [${r.chars.join(', ')}]`);
  }
}
