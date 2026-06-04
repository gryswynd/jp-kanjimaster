// app/shared/kana-collate.js
// Gojūon (あいうえお) collation for the glossary dictionary. Registers
// `window.JPShared.kanaCollate`. Stateless: turns a kana `reading` into a
// comparable sort key, compares two readings, and buckets a reading into one
// of the ten gojūon rows for section headers.
//
// We build an explicit kana→order table rather than leaning on
// localeCompare('ja'), whose Japanese collation is inconsistent across
// engines (and absent in some WebViews). Dakuten/handakuten and small kana
// sort *adjacent to* their base, matching paper-dictionary order:
//   か < が,  つ < づ,  や(small ゃ after や),  は < ば < ぱ.
(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // The 46 base gojūon sounds, in order. Each base owns its dakuten/handakuten
  // and small variant, which sort immediately after it (variantRank below).
  var BASE_ORDER = [
    'あ', 'い', 'う', 'え', 'お',
    'か', 'き', 'く', 'け', 'こ',
    'さ', 'し', 'す', 'せ', 'そ',
    'た', 'ち', 'つ', 'て', 'と',
    'な', 'に', 'ぬ', 'ね', 'の',
    'は', 'ひ', 'ふ', 'へ', 'ほ',
    'ま', 'み', 'む', 'め', 'も',
    'や', 'ゆ', 'よ',
    'ら', 'り', 'る', 'れ', 'ろ',
    'わ', 'を', 'ん'
  ];

  // variant kana → { base, rank }. rank: 0 plain, 1 small, 2 dakuten, 3 handakuten.
  // (small ranks before dakuten so ゃ sorts right after や and before any が-style
  // voicing on the same base — small kana never carry voicing.)
  var VARIANT = {
    // small vowels / や-row / わ
    'ぁ': ['あ', 1], 'ぃ': ['い', 1], 'ぅ': ['う', 1], 'ぇ': ['え', 1], 'ぉ': ['お', 1],
    'ゃ': ['や', 1], 'ゅ': ['ゆ', 1], 'ょ': ['よ', 1], 'ゎ': ['わ', 1], 'っ': ['つ', 1],
    // dakuten (voiced)
    'が': ['か', 2], 'ぎ': ['き', 2], 'ぐ': ['く', 2], 'げ': ['け', 2], 'ご': ['こ', 2],
    'ざ': ['さ', 2], 'じ': ['し', 2], 'ず': ['す', 2], 'ぜ': ['せ', 2], 'ぞ': ['そ', 2],
    'だ': ['た', 2], 'ぢ': ['ち', 2], 'づ': ['つ', 2], 'で': ['て', 2], 'ど': ['と', 2],
    'ば': ['は', 2], 'び': ['ひ', 2], 'ぶ': ['ふ', 2], 'べ': ['へ', 2], 'ぼ': ['ほ', 2],
    'ゔ': ['う', 2],
    // handakuten (p-)
    'ぱ': ['は', 3], 'ぴ': ['ひ', 3], 'ぷ': ['ふ', 3], 'ぺ': ['へ', 3], 'ぽ': ['ほ', 3]
  };

  // base kana → its index in BASE_ORDER, built once.
  var BASE_INDEX = {};
  for (var bi = 0; bi < BASE_ORDER.length; bi++) BASE_INDEX[BASE_ORDER[bi]] = bi;

  // Sentinel index for anything that isn't kana (digits, latin, symbols) → sorts last.
  var OTHER = BASE_ORDER.length; // 46

  // The ten row anchors, in order, for section headers. を/ん fold into the わ row.
  var ROWS = [
    { row: 'あ', label: 'あ行', max: BASE_INDEX['お'] },
    { row: 'か', label: 'か行', max: BASE_INDEX['こ'] },
    { row: 'さ', label: 'さ行', max: BASE_INDEX['そ'] },
    { row: 'た', label: 'た行', max: BASE_INDEX['と'] },
    { row: 'な', label: 'な行', max: BASE_INDEX['の'] },
    { row: 'は', label: 'は行', max: BASE_INDEX['ほ'] },
    { row: 'ま', label: 'ま行', max: BASE_INDEX['も'] },
    { row: 'や', label: 'や行', max: BASE_INDEX['よ'] },
    { row: 'ら', label: 'ら行', max: BASE_INDEX['ろ'] },
    { row: 'わ', label: 'わ行', max: BASE_INDEX['ん'] }
  ];

  // Katakana → hiragana (defensive; readings are hiragana but be safe).
  // Katakana block U+30A1–U+30F6 maps to hiragana by subtracting 0x60.
  function toHira(ch) {
    var c = ch.charCodeAt(0);
    if (c >= 0x30a1 && c <= 0x30f6) return String.fromCharCode(c - 0x60);
    return ch;
  }

  // Resolve one character to { base: index, variant: rank }.
  function classify(ch) {
    var h = toHira(ch);
    if (VARIANT[h]) return { base: BASE_INDEX[VARIANT[h][0]], variant: VARIANT[h][1] };
    if (BASE_INDEX[h] != null) return { base: BASE_INDEX[h], variant: 0 };
    return { base: OTHER, variant: 0 };
  }

  // Comparable, fixed-width key. Each char → 4 digits: 2 for base index (00–46),
  // 1 for variant rank, plus a leading pad so plain string compare is correct.
  function key(reading) {
    var s = String(reading == null ? '' : reading);
    var out = '';
    var lastVowelIdx = -1; // for chōonpu ー → repeat prior vowel's base
    for (var i = 0; i < s.length; i++) {
      var ch = s[i];
      if (ch === 'ー' || ch === 'ー') {
        // long-vowel mark: reuse the previous base so へや vs へーや stay adjacent
        if (lastVowelIdx >= 0) out += pad(lastVowelIdx, 0);
        continue;
      }
      var c = classify(ch);
      out += pad(c.base, c.variant);
      lastVowelIdx = c.base;
    }
    return out;
  }

  function pad(base, variant) {
    // base 00–46 (two digits), variant 0–3 (one digit).
    var b = base < 10 ? '0' + base : '' + base;
    return b + variant;
  }

  function compare(a, b) {
    var ka = key(a);
    var kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  }

  // First-character row bucket for section headers.
  function rowOf(reading) {
    var s = String(reading == null ? '' : reading);
    if (!s.length) return { row: '他', label: 'その他' };
    var c = classify(s[0]);
    if (c.base === OTHER) return { row: '他', label: 'その他' };
    for (var i = 0; i < ROWS.length; i++) {
      if (c.base <= ROWS[i].max) return { row: ROWS[i].row, label: ROWS[i].label };
    }
    return { row: '他', label: 'その他' };
  }

  // Ordered row anchors, exposed so the index view can render a jump-rail / fixed
  // section order without re-deriving it.
  var ROW_ORDER = ROWS.map(function (r) { return { row: r.row, label: r.label }; })
    .concat([{ row: '他', label: 'その他' }]);

  window.JPShared.kanaCollate = {
    key: key,
    compare: compare,
    rowOf: rowOf,
    ROW_ORDER: ROW_ORDER
  };
})();
