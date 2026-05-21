/**
 * app/shared/text-processor.js
 * Shared conjugation engine, counter engine, and text annotation for Japanese
 * lesson content.
 *
 * Replaces duplicated implementations in:
 *   - Lesson.js  — GODAN_MAPS, conjugate(), processText(), getRootTerm()
 *   - Review.js  — GODAN_MAPS (3/5 maps), conjugate() method (missing reading &
 *                  meaning updates), processText() method, getRootTerm() method
 *   - Story.js   — GODAN_MAPS, conjugate() (dead code, never called at runtime;
 *                  processStoryHTML / findTermsInText kept in Story.js because
 *                  they use a TreeWalker on already-rendered marked.js HTML and
 *                  take a surface→{id,form} dict rather than term-ref arrays)
 *
 * Load this file before any feature module scripts.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // ---------------------------------------------------------------------------
  // Godan verb stem-change tables (canonical 5-map set from Lesson.js)
  // ---------------------------------------------------------------------------
  var GODAN_MAPS = {
    u_to_i: { 'う': 'い', 'く': 'き', 'ぐ': 'ぎ', 'す': 'し', 'つ': 'ち', 'ぬ': 'に', 'ぶ': 'び', 'む': 'み', 'る': 'り' },
    u_to_a: { 'う': 'わ', 'く': 'か', 'ぐ': 'が', 'す': 'さ', 'つ': 'た', 'ぬ': 'な', 'ぶ': 'ば', 'む': 'ま', 'る': 'ら' },
    u_to_e: { 'う': 'え', 'く': 'け', 'ぐ': 'げ', 'す': 'せ', 'つ': 'て', 'ぬ': 'ね', 'ぶ': 'べ', 'む': 'め', 'る': 'れ' },
    u_to_o: { 'う': 'お', 'く': 'こ', 'ぐ': 'ご', 'す': 'そ', 'つ': 'と', 'ぬ': 'の', 'ぶ': 'ぼ', 'む': 'も', 'る': 'ろ' },
    ta_form:   { 'う': 'った',  'つ': 'った',  'る': 'った',  'む': 'んだ',  'ぶ': 'んだ',  'ぬ': 'んだ',  'く': 'いた',  'ぐ': 'いだ',  'す': 'した'  },
    te_form:   { 'う': 'って',  'つ': 'って',  'る': 'って',  'む': 'んで',  'ぶ': 'んで',  'ぬ': 'んで',  'く': 'いて',  'ぐ': 'いで',  'す': 'して'  },
    tari_form: { 'う': 'ったり', 'つ': 'ったり', 'る': 'ったり', 'む': 'んだり', 'ぶ': 'んだり', 'ぬ': 'んだり', 'く': 'いたり', 'ぐ': 'いだり', 'す': 'したり' },
    tara_form: { 'う': 'ったら', 'つ': 'ったら', 'る': 'ったら', 'む': 'んだら', 'ぶ': 'んだら', 'ぬ': 'んだら', 'く': 'いたら', 'ぐ': 'いだら', 'す': 'したら' }
  };

  // ---------------------------------------------------------------------------
  // Counter engine — builds surface+reading for number+counter pairs.
  // Rules are loaded from counter_rules.json and passed in as counterRules.
  //
  // buildCounterTerm("ji", 8, rules)   → { id, surface:"八時", reading:"はちじ", meaning:"8 o'clock" }
  // buildCounterTerm("fun", 30, rules) → { id, surface:"三十分", reading:"さんじゅうふん", … }
  //
  // overrideKey: digit/place key of the final number component, used to look up
  // per-counter prefix_overrides and counter_overrides:
  //   "1"–"9"  → units digit               (e.g. n=8 → "8", n=16 → "6")
  //   "10"     → standalone 十 (count===1)  (e.g. n=10, n=110)
  //   null     → round tens / euphonic      (no counter override applies)
  // ---------------------------------------------------------------------------
  var COUNTER_PLACE_ORDER = [10000, 1000, 100, 10];

  function counterBuildNumber(n, rules) {
    if (!n || n < 1 || n !== Math.floor(n)) return null;
    var surface = '', reading = '', overrideKey = null, remaining = n;
    for (var pi = 0; pi < COUNTER_PLACE_ORDER.length; pi++) {
      var place = COUNTER_PLACE_ORDER[pi];
      if (remaining < place) continue;
      var count = Math.floor(remaining / place);
      remaining -= count * place;
      var isLast = (remaining === 0);
      var placeData = rules.places[String(place)];
      var eKey = String(count);
      if (placeData.euphonics && placeData.euphonics[eKey]) {
        // Euphonic combo (e.g. 6+百 → ろっぴゃく) — prefix hardening baked in
        surface += (count > 1 ? rules.digits[eKey].surface : '') + placeData.surface;
        reading += placeData.euphonics[eKey];
      } else {
        if (count > 1) { surface += rules.digits[eKey].surface; reading += rules.digits[eKey].reading; }
        surface += placeData.surface;
        reading += placeData.reading;
        if (isLast && count === 1) overrideKey = String(place); // e.g. "10"
      }
    }
    if (remaining > 0) {
      var dKey = String(remaining);
      surface += rules.digits[dKey].surface;
      reading += rules.digits[dKey].reading;
      overrideKey = dKey; // e.g. "8"
    }
    return { surface: surface, reading: reading, overrideKey: overrideKey };
  }

  function counterBaseReading(key, rules) {
    if (!key) return null;
    if (rules.places[key]) return rules.places[key].reading;
    if (rules.digits[key]) return rules.digits[key].reading;
    return null;
  }

  function buildCounterTerm(counterKey, n, rules) {
    if (!rules || !rules.counters) return null;
    var counter = rules.counters[counterKey];
    if (!counter) return null;
    var nInt = parseInt(n, 10);
    if (!nInt || nInt < 1) return null;
    // Whole-word special cases (e.g. 一人=ひとり, 二人=ふたり)
    if (counter.special && counter.special[String(nInt)]) {
      var sp = counter.special[String(nInt)];
      return { id: 'count_' + nInt + '_' + counterKey, surface: sp.surface, reading: sp.reading, meaning: nInt + ' ' + counter.meaning };
    }
    var num = counterBuildNumber(nInt, rules);
    if (!num) return null;
    var oKey = num.overrideKey;
    var numReading = num.reading;
    // prefix_override: replace the final component's reading
    // e.g. overrideKey="4", ji → replace "よん" with "よ" → "よじ"
    if (oKey && counter.prefix_overrides && counter.prefix_overrides[oKey]) {
      var origBase = counterBaseReading(oKey, rules);
      if (origBase && numReading.slice(-origBase.length) === origBase)
        numReading = numReading.slice(0, -origBase.length) + counter.prefix_overrides[oKey];
    }
    // counter_override: swap the counter suffix reading
    // e.g. overrideKey="6", fun → "ふん" → "ぷん"
    var counterReading = (oKey && counter.counter_overrides && counter.counter_overrides[oKey])
      ? counter.counter_overrides[oKey] : counter.reading;
    return { id: 'count_' + nInt + '_' + counterKey, surface: num.surface + counter.surface, reading: numReading + counterReading, meaning: nInt + ' ' + counter.meaning };
  }

  // Expose so future modules (Lesson.js, Game.js, …) can call without a
  // separate script load.
  window.JPShared.counterEngine = { buildCounterTerm: buildCounterTerm };

  // ---------------------------------------------------------------------------

  window.JPShared.textProcessor = {

    // Expose maps in case callers need direct access
    GODAN_MAPS: GODAN_MAPS,

    // -------------------------------------------------------------------------
    // conjugate(term, ruleKey, conjugationRules)
    //
    // Applies a conjugation rule to a glossary term object.
    // Canonical implementation from Lesson.js — handles all 4 rule types and
    // correctly updates both surface AND reading (Review.js only updated surface).
    //
    // Supported rule.type values:
    //   replace        — substitute fixed surface + reading from rule
    //   suffix         — remove optional tail, append rule.add to surface+reading
    //   godan_change   — map last kana via GODAN_MAPS, append rule.add
    //   godan_euphonic — map last kana via GODAN_MAPS (no suffix appended)
    //
    // @param {Object} term              - glossary entry (surface, reading, meaning, …)
    // @param {string} ruleKey           - key in conjugationRules (e.g. 'polite_past')
    // @param {Object} conjugationRules  - parsed conjugation_rules.json
    // @returns {Object} new term with updated id / surface / reading / meaning /
    //                   original_id; or the original term if rule not found
    // -------------------------------------------------------------------------
    conjugate: function (term, ruleKey, conjugationRules) {
      if (!term || !conjugationRules) return term;
      var formDef = conjugationRules[ruleKey];
      if (!formDef) return term;

      // Normalise verb class labels used across different data sources
      var vClass = term.verb_class || term.gtype;
      if (vClass === 'u')    vClass = 'godan';
      if (vClass === 'ru')   vClass = 'ichidan';
      if (vClass === 'verb') vClass = 'godan';
      if (!vClass)           vClass = 'godan';
      // irr_iku: uses godan rules for most forms; conjugation_rules.json
      // provides replace overrides for the four euphonic forms (te/ta/tari/tara)
      // where 行く → 行って (not 行いて) is the standard irregular pattern.
      if (vClass === 'irr_iku' && !formDef.rules['irr_iku']) vClass = 'godan';

      var rule = formDef.rules[vClass];
      if (!rule) return term;

      var newSurface = term.surface;
      var newReading = term.reading || '';

      if (rule.type === 'replace') {
        newSurface = rule.surface;
        newReading = rule.reading;

      } else if (rule.type === 'suffix') {
        if (rule.remove && newSurface.endsWith(rule.remove)) {
          newSurface = newSurface.slice(0, -rule.remove.length) + rule.add;
          newReading = newReading.slice(0, -rule.remove.length) + rule.add;
        } else {
          newSurface += rule.add;
          newReading += rule.add;
        }

      } else if (rule.type === 'godan_change') {
        var lastChar = newSurface.slice(-1);
        var map = GODAN_MAPS[rule.map];
        if (map && map[lastChar]) {
          newSurface = newSurface.slice(0, -1) + map[lastChar] + rule.add;
          // Reading tail may differ from surface tail (e.g. kanji surface, kana reading)
          newReading = newReading.slice(0, -1) + (map[newReading.slice(-1)] || newReading.slice(-1)) + rule.add;
        }

      } else if (rule.type === 'godan_euphonic') {
        var lastChar = newSurface.slice(-1);
        var lastReadingChar = newReading.slice(-1);
        var map = GODAN_MAPS[rule.map];
        if (map && map[lastChar]) {
          newSurface = newSurface.slice(0, -1) + map[lastChar] + (rule.add || '');
          newReading = newReading.slice(0, -1) + (map[lastReadingChar] || map[lastChar]) + (rule.add || '');
        }
      }

      return Object.assign({}, term, {
        id:          term.id + '_' + ruleKey,
        surface:     newSurface,
        reading:     newReading,
        meaning:     term.meaning + ' (' + formDef.label + ')',
        original_id: term.id
      });
    },

    // -------------------------------------------------------------------------
    // processText(text, termRefs, termMap, conjugationRules, counterRules)
    //
    // HTML-escapes text, then wraps each recognised term in a clickable span
    // that fires window.JP_OPEN_TERM(id, true).
    //
    // termRefs entries can be:
    //   string            — direct term ID looked up in termMap
    //   {id, form}        — term ID + conjugation form; conjugated result is
    //                       cached back into termMap so openTerm() can find it
    //   {counter, n}      — generates a synthetic term via the counter engine
    //                       e.g. { "counter": "ji", "n": 8 } → 八時/はちじ
    //
    // Terms are matched longest-surface-first to prevent partial overlaps.
    // Falls back to t.reading when t.surface isn't found in the escaped HTML.
    //
    // @param {string}   text              - raw Japanese text
    // @param {Array}    termRefs          - array of string IDs or {id,form}/{counter,n} objects
    // @param {Object}   termMap           - mutable { id → term } lookup; generated
    //                                       terms are written back here
    // @param {Object}   conjugationRules  - parsed conjugation_rules.json
    // @param {Object}   counterRules      - parsed counter_rules.json (optional)
    // @returns {string} HTML string safe for innerHTML
    // -------------------------------------------------------------------------
    processText: function (text, termRefs, termMap, conjugationRules, counterRules) {
      if (!text) return '';
      var html = String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      if (!termRefs || termRefs.length === 0) return html;

      var self = this;
      var terms = termRefs.map(function (ref) {
        if (typeof ref === 'string') {
          return termMap[ref] || null;
        }
        if (typeof ref === 'object' && ref.id && (ref.form || ref.form === null)) {
          var rootTerm = termMap[ref.id];
          if (!rootTerm) return null;
          // form: null = purpose construction (masu-stem + に); fall back to masu_stem rule
          var ruleKey = ref.form !== null ? ref.form : 'masu_stem';
          var conjugated = self.conjugate(rootTerm, ruleKey, conjugationRules);
          if (conjugated) termMap[conjugated.id] = conjugated; // cache for openTerm()
          return conjugated;
        }
        if (typeof ref === 'object' && ref.counter !== undefined) {
          if (!counterRules) return null;
          var counterTerm = buildCounterTerm(ref.counter, ref.n, counterRules);
          if (counterTerm) termMap[counterTerm.id] = counterTerm; // cache for openTerm()
          return counterTerm;
        }
        return null;
      }).filter(Boolean).sort(function (a, b) {
        if (b.surface.length !== a.surface.length) {
          return b.surface.length - a.surface.length; // longest first → no partial matches
        }
        // Same length: kana-only terms (particles/function words) before kanji-containing
        // terms. This matters for single-char matching: the regex (?![\\u3040-\\u30FF])
        // blocks a kanji from matching when immediately followed by unhighlighted hiragana.
        // Wrapping particles first turns "父と" into "父<span>と</span>", so the kanji
        // is then followed by '<' not hiragana and the lookahead passes.
        var aIsKana = !/[\u4E00-\u9FFF\uF900-\uFAFF]/.test(a.surface);
        var bIsKana = !/[\u4E00-\u9FFF\uF900-\uFAFF]/.test(b.surface);
        if (aIsKana !== bIsKana) return aIsKana ? -1 : 1;
        return 0;
      });

      terms.forEach(function (t) {
        var matchedForm = null;
        if (html.indexOf(t.surface) !== -1) {
          matchedForm = t.surface;
        } else if (t.reading && html.indexOf(t.reading) !== -1) {
          matchedForm = t.reading; // fallback: match hiragana reading
        } else if (t.matches) {
          for (var i = 0; i < t.matches.length; i++) { // fallback: match alternate forms (e.g. mixed kanji/kana before full kanji is taught)
            if (html.indexOf(t.matches[i]) !== -1) { matchedForm = t.matches[i]; break; }
          }
        }
        if (matchedForm) {
          var cls = (t.type === 'character') ? 'jp-term jp-term-name' : 'jp-term';
          var span = '<span class="' + cls + '" onclick="window.JP_OPEN_TERM(\'' + t.id + '\', true)">' + matchedForm + '</span>';
          if (matchedForm.length === 1) {
            // Single-character terms (particles, etc.): avoid matching characters
            // that are word-internal, e.g. か inside やまかわ vs か at the end of ですか.
            // Only replace when NOT immediately followed by another hiragana or
            // katakana character (U+3040–U+30FF), which would indicate the character
            // is part of a longer kana word rather than a standalone particle.
            var esc = matchedForm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            html = html.replace(new RegExp(esc + '(?![\\u3040-\\u30FF])', 'g'), span);
          } else {
            html = html.split(matchedForm).join(span);
          }
        }
      });

      return html;
    },

    // -------------------------------------------------------------------------
    // getRootTerm(termId, termMap)
    //
    // Resolves a potentially-conjugated term ID to its base glossary entry.
    // Used by auto-flagging logic when a learner answers incorrectly — flags
    // the root term, not the conjugated form.
    //
    // Strategy:
    //   1. Direct lookup in termMap; if found and has original_id, follow it.
    //   2. Progressively strip '_'-delimited suffixes (conjugation form keys are
    //      appended as `${termId}_${ruleKey}`) until a base term is found.
    //
    // @param {string} termId   - term ID (may be base or conjugated form)
    // @param {Object} termMap  - { id → term } lookup
    // @returns {Object|null}   - base term object, or null if not found
    // -------------------------------------------------------------------------
    getRootTerm: function (termId, termMap) {
      var term = termMap[termId];
      if (term) {
        return term.original_id ? termMap[term.original_id] : term;
      }

      // Term not found — likely a conjugated form not yet generated.
      // Progressively strip trailing _-delimited segments to find the base.
      var parts = termId.split('_');
      while (parts.length > 1) {
        parts.pop();
        var candidateId = parts.join('_');
        term = termMap[candidateId];
        if (term) {
          return term.original_id ? termMap[term.original_id] : term;
        }
      }

      return null;
    }

  };

})();
