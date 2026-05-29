/**
 * app/shared/tts-normalize.js
 * Shared Japanese pronunciation normalization — the single source of truth for
 * turning display text into the canonical string we synthesize / look up.
 *
 * This file is DUAL-CONSUMABLE:
 *   - Browser: loaded as a plain <script>; attaches window.JPShared.ttsNormalize.
 *   - Node (build scripts): imported via createRequire(); exposes module.exports.
 *
 * The build-time audio generator and the runtime clip resolver BOTH call
 * normalizeKey() so the manifest key is byte-identical on both sides. If this
 * logic ever forks, clips silently fail to resolve — so keep it here, once.
 *
 * The normalization rules were moved verbatim from the old Web Speech tts.js:
 * static overrides for misread kanji compounds, partial-kanji reading fixes,
 * は→わ particle correction, and terms-aware readings driven by the glossary.
 */
(function (root, factory) {
  var mod = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = mod;            // Node (build scripts via createRequire)
  }
  if (typeof root !== 'undefined') {
    root.JPShared = root.JPShared || {};
    root.JPShared.ttsNormalize = mod; // browser
  }
})(typeof self !== 'undefined' ? self : (typeof globalThis !== 'undefined' ? globalThis : this), function () {
  'use strict';

  // Partial-kanji day names / compounds that TTS engines often botch.
  var readingFixes = [
    [/金よう日/g, 'きんようび'],
    [/月よう日/g, 'げつようび'],
    [/火よう日/g, 'かようび'],
    [/水よう日/g, 'すいようび'],
    [/木よう日/g, 'もくようび'],
    [/土よう日/g, 'どようび'],
    [/日よう日/g, 'にちようび'],
    [/何よう日/g, 'なんようび'],
    [/大すき/g, 'だいすき'],
    [/朝ごはん/g, 'あさごはん'],
    [/晩ごはん/g, 'ばんごはん'],
    [/名まえ/g, 'なまえ']
  ];

  // Kanji compounds whose correct reading TTS engines frequently get wrong.
  // Sorted longest-first at build time below so longer compounds win.
  var staticOverrides = [
    ['何時間', 'なんじかん'],
    ['何時ごろ', 'なんじごろ'],
    ['何時', 'なんじ'],
    ['何分', 'なんぷん'],
    ['何日', 'なんにち'],
    ['何人', 'なんにん'],
    ['何回', 'なんかい'],
    ['何本', 'なんぼん'],
    ['何枚', 'なんまい'],
    ['何冊', 'なんさつ'],
    ['何匹', 'なんびき'],
    ['何杯', 'なんばい'],
    ['何台', 'なんだい'],
    ['何歳', 'なんさい'],
    ['二十日', 'はつか'],
    ['十四日', 'じゅうよっか'],
    ['二十四日', 'にじゅうよっか'],
    ['十日', 'とおか'],
    ['三日', 'みっか'],
    ['四日', 'よっか'],
    ['八日', 'ようか'],
    ['九日', 'ここのか'],
    ['七日', 'なのか'],
    ['六日', 'むいか'],
    ['五日', 'いつか'],
    ['二日', 'ふつか'],
    ['一日', 'いちにち'],
    ['今日', 'きょう'],
    ['明日', 'あした'],
    ['昨日', 'きのう'],
    ['今朝', 'けさ'],
    ['今年', 'ことし'],
    ['去年', 'きょねん'],
    ['今夜', 'こんや'],
    ['今晩', 'こんばん'],
    ['二人', 'ふたり'],
    ['一人', 'ひとり'],
    ['上手', 'じょうず'],
    ['下手', 'へた'],
    ['大人', 'おとな'],
    ['今週', 'こんしゅう'],
    ['先週', 'せんしゅう'],
    ['来週', 'らいしゅう'],
    ['先月', 'せんげつ'],
    ['来月', 'らいげつ'],
    ['来年', 'らいねん'],
    ['毎日', 'まいにち'],
    ['毎週', 'まいしゅう'],
    ['毎月', 'まいつき'],
    ['毎年', 'まいとし'],
    ['毎朝', 'まいあさ'],
    ['毎晩', 'まいばん'],
    ['今月', 'こんげつ'],
    // --- Ambiguous kanji Chirp misreads. Compound guards listed too; the
    //     longest-first sort below means 金魚/人魚 are consumed before bare 魚,
    //     so 金魚→きんぎょ while a standalone 魚→さかな. Add new flags here. ---
    ['金魚', 'きんぎょ'],
    ['人魚', 'にんぎょ'],
    ['魚', 'さかな']
  ];

  // Build sorted-longest-first replacement pairs once. Literal string matching
  // (not regex) so special-regex characters in surface forms are never an issue.
  var _overridePairs = (function () {
    var pairs = staticOverrides.slice();
    pairs.sort(function (a, b) { return b[0].length - a[0].length; });
    return pairs;
  }());

  // Apply static override map: left-to-right scan, longest match first.
  function applyStaticOverrides(text) {
    var out = '';
    var i = 0;
    var len = text.length;
    outer: while (i < len) {
      for (var p = 0; p < _overridePairs.length; p++) {
        var surface = _overridePairs[p][0];
        var reading = _overridePairs[p][1];
        if (text.substr(i, surface.length) === surface) {
          out += reading;
          i += surface.length;
          continue outer;
        }
      }
      out += text[i];
      i++;
    }
    return out;
  }

  // Build a surface→reading map from a terms array + termMap (glossary).
  function buildReadingsFromTerms(terms, termMap) {
    if (!terms || !termMap) return [];
    var pairs = [];
    var seen = {};
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      var id = (typeof t === 'string') ? t : (t && t.id);
      if (!id || seen[id]) continue;
      seen[id] = true;
      var entry = termMap[id];
      if (!entry || !entry.surface || !entry.reading) continue;
      // Only override if surface contains kanji (kana-only entries read fine).
      if (!/[\u4E00-\u9FFF]/.test(entry.surface)) continue;
      // Don't add if surface === reading (already kana).
      if (entry.surface === entry.reading) continue;
      pairs.push([entry.surface, entry.reading]);
    }
    pairs.sort(function (a, b) { return b[0].length - a[0].length; });
    return pairs;
  }

  // Apply a surface→reading pairs array to text, longest-match-first.
  function applyReadingsMap(text, pairs) {
    if (!pairs || pairs.length === 0) return text;
    var out = '';
    var i = 0;
    var len = text.length;
    outer: while (i < len) {
      for (var p = 0; p < pairs.length; p++) {
        var surface = pairs[p][0];
        var reading = pairs[p][1];
        if (text.substr(i, surface.length) === surface) {
          out += reading;
          i += surface.length;
          continue outer;
        }
      }
      out += text[i];
      i++;
    }
    return out;
  }

  /**
   * Preprocess text. Order:
   *   1. Per-line terms-aware readings (most precise — glossary reading field)
   *   2. Static reading overrides (kanji compounds with wrong TTS defaults)
   *   3. Partial-kanji readingFixes (day-of-week, etc.)
   *   4. は particle pronunciation correction
   */
  function preprocess(text, termPairs) {
    if (!text) return text;

    if (termPairs && termPairs.length > 0) {
      text = applyReadingsMap(text, termPairs);
    }

    text = applyStaticOverrides(text);

    for (var i = 0; i < readingFixes.length; i++) {
      text = text.replace(readingFixes[i][0], readingFixes[i][1]);
    }

    // Particle は → わ. Chirp reads particle は as "wa" natively in kanji-rich
    // context but flubs it in kana-ish context (名まえは→"namae ha", 犬は→"inu ha"),
    // so we convert at particle boundaries. Two cases, both avoiding word-internal
    // は (はは, ごはん, おはよう — は followed by another KANA, never a particle):
    //   (a) は right after a KANJI → almost always noun+particle (主人は, 犬は, 母は),
    //       convert regardless of what follows (kana-initial next word included).
    //   (b) は after kana, FOLLOWED BY space/punctuation/kanji → particle at a
    //       bunsetsu boundary (名まえは , これは。). Excludes は-before-kana (はは,
    //       ごはん) and end-of-string (so isolated reading はは survives).
    // Greetings (こんにちは。→こんにちわ) convert correctly under (b).
    text = text.replace(/([一-鿿])は/g, '$1わ');                       // (a)
    text = text.replace(/([゠-ヿ぀-ゟー])は(?=[\s、。！？一-鿿])/g, '$1わ'); // (b)

    return text;
  }

  /**
   * The canonical manifest key for a piece of text. Build-time generator and
   * runtime resolver both call this; the result is the JSON key in the audio
   * manifest. Thin wrapper over preprocess() so "the key" and "what we spoke"
   * can never drift.
   */
  function normalizeKey(text, termPairs) {
    return preprocess((text == null ? '' : String(text)).trim(), termPairs);
  }

  // Hiragana → katakana.
  function toKatakana(s) {
    return String(s == null ? '' : s).replace(/[ぁ-ゖ]/g, function (c) {
      return String.fromCharCode(c.charCodeAt(0) + 0x60);
    });
  }

  // Key for an ISOLATED reading (kun/on chips, glossary readings). Chirp reads
  // isolated bare kana unreliably — it mistakes a non-initial は/へ/を for a
  // particle (はは→"ha-wa", へや→"e-ya"). Katakana forces literal phonemes
  // (はは→"ha-ha"), at the cost of a slightly enunciated delivery that's fine
  // for a pronunciation chip. Only readings carrying those ambiguous kana are
  // converted; others stay hiragana (smoother). Sentences NEVER use this — they
  // have context, so は reads natively as "wa".
  function readingKey(text) {
    var k = normalizeKey(text, null);
    return /[はへを]/.test(k) ? toKatakana(k) : k;
  }

  return {
    preprocess: preprocess,
    normalizeKey: normalizeKey,
    readingKey: readingKey,
    toKatakana: toKatakana,
    buildReadingsFromTerms: buildReadingsFromTerms,
    applyStaticOverrides: applyStaticOverrides,
    applyReadingsMap: applyReadingsMap,
    staticOverrides: staticOverrides,
    readingFixes: readingFixes
  };
});
