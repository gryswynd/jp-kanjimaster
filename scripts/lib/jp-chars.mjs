// scripts/lib/jp-chars.mjs
// The set of characters the bundled Japanese font subset must cover: every
// character (codepoint >= 0x2000) that appears in the app's content (data/ +
// shared/ JSON), plus all kana, CJK punctuation, fullwidth forms, and ASCII.
//
// Shared by vendor-fonts.mjs (what to subset) and validate-fonts.mjs (what to
// assert is covered) so the two can never drift apart.
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Emoji / pictographic symbols are rendered by the OS emoji font, never by the
// bundled Noto JP subset — so they must NOT be in the coverage requirement
// (e.g. loanword-origin flags 🇩🇪🇺🇸, 🕉, ⚡). Excludes the BMP symbol blocks,
// ZWJ / variation-selectors / keycap, and the entire SMP symbol+emoji range
// (U+1F000–U+1FFFF, which holds no kanji — CJK Ext B starts at U+20000).
function isEmojiOrSymbol(cp) {
  return (
    cp === 0x200d ||                       // zero-width joiner (emoji sequences)
    cp === 0x20e3 ||                       // combining enclosing keycap
    (cp >= 0x2600 && cp <= 0x27bf) ||      // misc symbols + dingbats
    (cp >= 0x2b00 && cp <= 0x2bff) ||      // misc symbols & arrows (★ etc.)
    (cp >= 0xfe00 && cp <= 0xfe0f) ||      // variation selectors
    (cp >= 0x1f000 && cp <= 0x1ffff)       // SMP symbols + emoji (flags live here)
  );
}

export function collectJpChars(root) {
  const chars = new Set();
  function walk(dir) {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith('.json')) {
        for (const ch of readFileSync(p, 'utf8')) {
          const cp = ch.codePointAt(0);
          if (cp >= 0x2000 && !isEmojiOrSymbol(cp)) chars.add(ch);
        }
      }
    }
  }
  walk(join(root, 'data'));
  walk(join(root, 'shared'));
  // Always-on ranges — cheap insurance for mixed/dynamic (e.g. Compose) text.
  for (let c = 0x20; c <= 0x7e; c++) chars.add(String.fromCodePoint(c));   // ASCII
  for (let c = 0x3040; c <= 0x30ff; c++) chars.add(String.fromCodePoint(c)); // kana
  for (let c = 0x3000; c <= 0x303f; c++) chars.add(String.fromCodePoint(c)); // CJK punct
  for (let c = 0xff00; c <= 0xffef; c++) chars.add(String.fromCodePoint(c)); // fullwidth
  return chars;
}
