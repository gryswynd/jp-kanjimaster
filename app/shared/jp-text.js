/**
 * app/shared/jp-text.js
 * Shared Japanese-text renderer for Furigana + Romaji toggles.
 *
 * Two user-flippable display modes live on <html> as CSS classes:
 *   .k-furigana  — small kana above kanji (via <ruby><rt>)
 *   .k-romaji    — Latin spelling below kanji + bare kana
 *
 * Toggles persist in localStorage as flat 'k-*' flags ('0'/'1'):
 *   k-furigana-on, k-romaji-on
 *
 * Data shape — every Japanese string field can have a sibling 'tokens' array:
 *   { jp: "私は学生です。", tokens: [
 *       { k: "私",   r: "わたし" },
 *       { k: "は",   r: "わ"   },   // per-occurrence: topic-particle reads wa
 *       { k: "学生", r: "がくせい" },
 *       { k: "です。" }                // bare kana — no r
 *   ]}
 *
 * Per-occurrence 'r' captures authored intent (the は/wa-vs-ha trap, etc.) —
 * the renderer NEVER guesses readings. If tokens are absent, output bare text.
 *
 * Romaji is NOT baked into the data; it's computed at render time from 'r'
 * via a Hepburn table (ou/ei long-vowels as-typed; no macrons).
 *
 * Load this file early — before any feature module that renders Japanese.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // -- HTML escape (same convention as Lesson/Compose/Review esc helpers) --
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ---------------------------------------------------------------------------
  // Hepburn romaji table — covers hiragana + katakana, including small-tsu
  // gemination, palatalized digraphs (きゃ/しゃ/…), and long-vowel chōonpu (ー).
  // 'ou' / 'ei' stay as typed (no macrons) so the output matches IME input.
  // ---------------------------------------------------------------------------
  var HEPBURN = (function () {
    var base = {
      'あ':'a','い':'i','う':'u','え':'e','お':'o',
      'か':'ka','き':'ki','く':'ku','け':'ke','こ':'ko',
      'が':'ga','ぎ':'gi','ぐ':'gu','げ':'ge','ご':'go',
      'さ':'sa','し':'shi','す':'su','せ':'se','そ':'so',
      'ざ':'za','じ':'ji','ず':'zu','ぜ':'ze','ぞ':'zo',
      'た':'ta','ち':'chi','つ':'tsu','て':'te','と':'to',
      'だ':'da','ぢ':'ji','づ':'zu','で':'de','ど':'do',
      'な':'na','に':'ni','ぬ':'nu','ね':'ne','の':'no',
      'は':'ha','ひ':'hi','ふ':'fu','へ':'he','ほ':'ho',
      'ば':'ba','び':'bi','ぶ':'bu','べ':'be','ぼ':'bo',
      'ぱ':'pa','ぴ':'pi','ぷ':'pu','ぺ':'pe','ぽ':'po',
      'ま':'ma','み':'mi','む':'mu','め':'me','も':'mo',
      'や':'ya','ゆ':'yu','よ':'yo',
      'ら':'ra','り':'ri','る':'ru','れ':'re','ろ':'ro',
      'わ':'wa','ゐ':'wi','ゑ':'we','を':'wo','ん':'n',
      'ぁ':'a','ぃ':'i','ぅ':'u','ぇ':'e','ぉ':'o',
      'ゃ':'ya','ゅ':'yu','ょ':'yo',
      'ー':'-' // chōonpu fallback; lengthening is handled below
    };
    var digraphs = {
      'きゃ':'kya','きゅ':'kyu','きょ':'kyo',
      'ぎゃ':'gya','ぎゅ':'gyu','ぎょ':'gyo',
      'しゃ':'sha','しゅ':'shu','しょ':'sho',
      'じゃ':'ja','じゅ':'ju','じょ':'jo',
      'ちゃ':'cha','ちゅ':'chu','ちょ':'cho',
      'にゃ':'nya','にゅ':'nyu','にょ':'nyo',
      'ひゃ':'hya','ひゅ':'hyu','ひょ':'hyo',
      'びゃ':'bya','びゅ':'byu','びょ':'byo',
      'ぴゃ':'pya','ぴゅ':'pyu','ぴょ':'pyo',
      'みゃ':'mya','みゅ':'myu','みょ':'myo',
      'りゃ':'rya','りゅ':'ryu','りょ':'ryo'
    };
    return { base: base, digraphs: digraphs };
  })();

  // Convert katakana code-points to hiragana so one table handles both scripts.
  // Range: U+30A1–30F6 → U+3041–3096 (offset -0x60). Leaves chōonpu (ー) alone.
  function kataToHira(s) {
    return String(s).replace(/[ァ-ヶ]/g, function (ch) {
      return String.fromCharCode(ch.charCodeAt(0) - 0x60);
    });
  }

  /**
   * Convert a kana string (hira/kata mix) to Hepburn romaji.
   * Returns lowercased ASCII. Non-kana characters pass through unchanged.
   */
  function kanaToRomaji(input) {
    if (!input) return '';
    var s = kataToHira(input);
    var out = '';
    var i = 0;
    while (i < s.length) {
      var pair = s.charAt(i) + s.charAt(i + 1);
      // Digraph first (二文字)
      if (HEPBURN.digraphs[pair]) {
        out += HEPBURN.digraphs[pair];
        i += 2;
        continue;
      }
      var c = s.charAt(i);
      // Small-tsu (っ) doubles the next consonant: っか → kka
      if (c === 'っ' || c === 'ッ') {
        var nextPair = s.charAt(i + 1) + s.charAt(i + 2);
        var nextRom = HEPBURN.digraphs[nextPair] || HEPBURN.base[s.charAt(i + 1)] || '';
        if (nextRom) {
          // 'chi' → 'tchi' (Hepburn convention) rather than 'cchi'.
          if (nextRom.charAt(0) === 'c') out += 't';
          else out += nextRom.charAt(0);
        }
        i += 1;
        continue;
      }
      // Long-vowel chōonpu: repeat previous vowel
      if (c === 'ー') {
        var lastVowel = out.match(/[aeiou]$/);
        out += lastVowel ? lastVowel[0] : '-';
        i += 1;
        continue;
      }
      if (HEPBURN.base[c] != null) {
        out += HEPBURN.base[c];
      } else {
        out += c; // pass-through (punctuation, kanji, latin, etc.)
      }
      i += 1;
    }
    return out;
  }

  // ---------------------------------------------------------------------------
  // Token rendering
  //
  // Token shapes accepted:
  //   { k: "学生", r: "がくせい" }   ← kanji w/ reading
  //   { k: "は", r: "わ" }            ← per-occurrence override
  //   { k: "です。" }                  ← bare kana / punctuation (no r)
  //   "は"                            ← shorthand: string == bare segment
  // ---------------------------------------------------------------------------

  // Detect whether a token's surface needs furigana.
  // Standard Japanese typography puts furigana over KANJI only, never over
  // kana — even particles like は (read わ) get no furigana, since the
  // particle-pronunciation rule is something the reader learns by heart.
  //
  // The 'r' field on a kana-only token is STILL meaningful — it carries the
  // true pronunciation that drives the romaji output (so は-as-particle
  // shows "wa" underneath in romaji mode while displaying no furigana above).
  var KANJI_RE = /[一-鿿㐀-䶿]/;
  function needsRuby(tok) {
    if (!tok || typeof tok !== 'object') return false;
    if (!tok.r) return false;
    if (tok.r === tok.k) return false;
    return KANJI_RE.test(tok.k || '');
  }

  function renderToken(tok, opts) {
    if (typeof tok === 'string') tok = { k: tok };
    var k = tok.k || '';
    var r = tok.r || '';
    // opts.noRomaji: when true, omit per-token romaji. Used by callers that
    // render a SINGLE combined romaji line under a group of tokens (e.g.
    // 来ます → "kimasu" continuous, not "ki" + gap + "masu" centered under
    // each token's own width).
    var noRomaji = opts && opts.noRomaji;
    if (needsRuby(tok)) {
      var rom = kanaToRomaji(r);
      return '<span class="jp-token">' +
        '<ruby>' + esc(k) + '<rt class="rt-furigana">' + esc(r) + '</rt></ruby>' +
        (noRomaji ? '' : '<span class="rt-romaji">' + esc(rom) + '</span>') +
        '</span>';
    }
    if (k && /[぀-ゟ゠-ヿ]/.test(k)) {
      var rom2 = kanaToRomaji(r || k);
      return '<span class="jp-token jp-token-bare">' +
        '<span class="jp-base">' + esc(k) + '</span>' +
        (noRomaji ? '' : '<span class="rt-romaji">' + esc(rom2) + '</span>') +
        '</span>';
    }
    return esc(k);
  }

  // Compute the combined romaji string for a sequence of tokens. Used to
  // render a single continuous romaji line under grouped chips.
  function tokensToRomaji(tokens) {
    if (!Array.isArray(tokens)) return '';
    var out = '';
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      var k = t.k || '';
      var r = t.r || '';
      out += kanaToRomaji(r || k);
    }
    return out;
  }

  function renderTokens(tokens) {
    if (!Array.isArray(tokens) || !tokens.length) return '';
    var out = '';
    for (var i = 0; i < tokens.length; i++) out += renderToken(tokens[i]);
    return out;
  }

  /**
   * Primary render entry. Accepts:
   *   - { tokens, jp }      → renderTokens(tokens) if present, else esc(jp)
   *   - { tokens, text }    → same with .text fallback
   *   - { surface, reading }→ glossary-style; emits one token if reading != surface
   *   - string              → esc'd plain text (and romaji-wrapped if all kana)
   *
   * Returns an HTML string ready to inject. Always safe (callers don't escape).
   */
  function render(input) {
    if (input == null || input === '') return '';
    if (typeof input === 'string') return renderTokens([{ k: input }]);
    if (Array.isArray(input)) return renderTokens(input);
    if (typeof input === 'object') {
      if (input.tokens && input.tokens.length) return renderTokens(input.tokens);
      // Glossary-style shorthand: {surface, reading} → single token.
      if (input.surface != null) {
        if (input.reading && input.reading !== input.surface) {
          return renderToken({ k: input.surface, r: input.reading });
        }
        return renderTokens([{ k: input.surface }]);
      }
      // Free-text fallback: prefer .jp, then .text, then any string-ish field.
      var raw = input.jp != null ? input.jp
              : (input.text != null ? input.text
              : (input.surface != null ? input.surface : ''));
      return renderTokens([{ k: String(raw) }]);
    }
    return esc(String(input));
  }

  // ---------------------------------------------------------------------------
  // Reading-aids toggle (CSS-class flip on <html>)
  //
  // No re-render is needed for CSS-driven views — the ruby markup is always in
  // the DOM and visibility is gated entirely by .k-furigana / .k-romaji on
  // <html>. For JS-built strings (e.g. Practice.setTxt) callers can attach a
  // listener via onChange() to re-run their render path.
  // ---------------------------------------------------------------------------
  var FURIGANA_KEY = 'k-furigana-on';
  var ROMAJI_KEY   = 'k-romaji-on';
  var changeListeners = [];

  function isOn(key) { return localStorage.getItem(key) === '1'; }

  function applyReadingAids() {
    var h = document.documentElement;
    if (!h) return;
    h.classList.toggle('k-furigana', isOn(FURIGANA_KEY));
    h.classList.toggle('k-romaji',   isOn(ROMAJI_KEY));
  }

  function setFurigana(on) {
    try { localStorage.setItem(FURIGANA_KEY, on ? '1' : '0'); } catch (e) {}
    applyReadingAids();
    _fireChange();
  }
  function setRomaji(on) {
    try { localStorage.setItem(ROMAJI_KEY, on ? '1' : '0'); } catch (e) {}
    applyReadingAids();
    _fireChange();
  }

  function onChange(fn) { if (typeof fn === 'function') changeListeners.push(fn); }
  function _fireChange() {
    for (var i = 0; i < changeListeners.length; i++) {
      try { changeListeners[i](); } catch (e) {}
    }
  }

  /**
   * For JS-built views that emit Japanese text via setTextContent rather than
   * through render(). Modules opt in by calling onChange(rerenderFn).
   */
  function refreshAll() { _fireChange(); }

  window.JPShared.jpText = {
    render: render,
    renderTokens: renderTokens,
    renderToken: renderToken,
    tokensToRomaji: tokensToRomaji,
    kanaToRomaji: kanaToRomaji,
    needsRuby: needsRuby,
    applyReadingAids: applyReadingAids,
    isFuriganaOn: function () { return isOn(FURIGANA_KEY); },
    isRomajiOn:   function () { return isOn(ROMAJI_KEY); },
    setFurigana: setFurigana,
    setRomaji:   setRomaji,
    onChange: onChange,
    refreshAll: refreshAll
  };

  // Apply current state immediately if the DOM is already parsed (this script
  // is loaded synchronously from index.html early). Otherwise wait.
  if (document.readyState !== 'loading') {
    applyReadingAids();
  } else {
    document.addEventListener('DOMContentLoaded', applyReadingAids, { once: true });
  }
})();
