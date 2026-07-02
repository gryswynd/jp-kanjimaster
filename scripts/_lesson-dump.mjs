#!/usr/bin/env node
// TEMP audit tool: dump a lesson's human-facing content in readable form.
// Usage: node scripts/_lesson-dump.mjs N5.16
import { readFileSync } from 'fs';

const id = process.argv[2];
if (!id) { console.error('usage: _lesson-dump.mjs <N5.16>'); process.exit(1); }
const level = id.split('.')[0];
const data = JSON.parse(readFileSync(`data/${level}/lessons/${id}.json`, 'utf8'));

console.log(`=== ${data.id} — ${data.title} ===`);
if (data.meta) console.log(`focus: ${data.meta.focus || ''}`);
if (data.newKanji) console.log('kanji: ' + data.newKanji.map(k => `${k.kanji}(${k.meaning})`).join(' '));

for (let si = 0; si < (data.sections || []).length; si++) {
  const s = data.sections[si];
  console.log(`\n--- section[${si}] type=${s.type} title=${s.title || ''} ---`);
  if (s.instructions) console.log(`  instructions: ${s.instructions}`);
  if (s.context) console.log(`  context: ${s.context}`);
  for (let ii = 0; ii < (s.items || []).length; ii++) {
    const it = s.items[ii];
    dumpItem(it, `  [${ii}]`);
  }
  if (s.lines) dumpConvo(s, '  ');
  for (const key of ['conversations', 'readings', 'drills', 'questions', 'passages']) {
    if (Array.isArray(s[key])) {
      for (let ci = 0; ci < s[key].length; ci++) {
        console.log(`  ${key}[${ci}]:`);
        dumpItem(s[key][ci], '    ');
      }
    }
  }
}

function dumpConvo(c, ind) {
  if (c.context) console.log(`${ind}context: ${c.context}`);
  if (c.speakers) console.log(`${ind}speakers: ${JSON.stringify(c.speakers)}`);
  for (const l of c.lines || []) {
    console.log(`${ind}${l.spk ?? '?'}: ${l.jp ?? ''}`);
    if (l.en) console.log(`${ind}   en: ${l.en}`);
  }
}

function dumpItem(it, ind) {
  if (it == null) return;
  if (typeof it !== 'object') { console.log(`${ind} ${it}`); return; }
  if (Array.isArray(it.lines)) { dumpConvo(it, ind + ' '); return; }
  for (const [k, v] of Object.entries(it)) {
    if (k === 'terms' || k === 'tokens') continue;
    if (Array.isArray(v) && v.every(x => typeof x !== 'object')) {
      console.log(`${ind} ${k}: ${v.join(' | ')}`);
    } else if (typeof v === 'object' && v !== null) {
      console.log(`${ind} ${k}:`);
      if (Array.isArray(v)) v.forEach((x, i) => dumpItem(x, ind + `  (${i})`));
      else dumpItem(v, ind + '  ');
    } else {
      console.log(`${ind} ${k}: ${v}`);
    }
  }
}
