/**
 * app/shared/written-answer.js
 * Shared lenient grader for free-text ("written") Japanese comprehension answers.
 *
 * Extracted from Stories.js so Stories AND Lessons grade identically (one
 * implementation — see the duplicated-drag lesson we already paid for).
 *
 * The matcher is content-agnostic: callers pass a `readingFn(text) -> kana` that
 * resolves kanji to its reading from whatever source they have (a story's own
 * tokens, or a lesson's glossary termMap). Helpers below build that function.
 *
 * Registers on window.JPShared.writtenAnswer. Load before feature modules.
 */
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};

  // Normalize an answer for lenient comparison: NFKC fold (full→half width),
  // strip all whitespace, trim trailing sentence punctuation. Kana/kanji kept
  // exactly as authored — readings are never guessed here.
  function normAns(s) {
    return String(s == null ? '' : s)
      .normalize('NFKC')
      .replace(/\s+/g, '')
      .replace(/[。.．、,!！?？]+$/u, '')
      .trim();
  }
  var hasKanji = function (s) { return /[一-鿿㐀-䶿]/.test(s); };
  var kataToHira = function (s) {
    return String(s).replace(/[ァ-ヶ]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 0x60); });
  };

  // Build a readingFn from [surface, reading] pairs (greedy longest-match,
  // katakana→hiragana). Unmatched chars pass through. Sort pairs longest-first.
  function makeReadingFn(pairs) {
    var sorted = (pairs || []).slice().sort(function (a, b) { return b[0].length - a[0].length; });
    return function (text) {
      var out = '', i = 0;
      while (i < text.length) {
        var hit = null;
        for (var k = 0; k < sorted.length; k++) {
          var s = sorted[k][0];
          if (s && text.startsWith(s, i)) { hit = sorted[k]; break; }
        }
        if (hit) { out += hit[1]; i += hit[0].length; } else { out += text[i]; i++; }
      }
      return kataToHira(out);
    };
  }

  // Surface→reading pairs from a glossary termMap (id → {surface, reading, tokens}).
  // Whole-word surfaces plus each kanji-bearing token, kanji entries only.
  function pairsFromTermMap(termMap) {
    var pairs = [], seen = {};
    var add = function (surf, read) {
      if (surf && read && hasKanji(surf) && !seen[surf]) { seen[surf] = 1; pairs.push([surf, read]); }
    };
    for (var id in (termMap || {})) {
      var e = termMap[id];
      if (!e) continue;
      add(e.surface, e.reading);
      var toks = e.tokens || [];
      for (var i = 0; i < toks.length; i++) add(toks[i].k, toks[i].r);
    }
    return pairs;
  }

  // ── Conjugation-tolerant layer ─────────────────────────────────────────────
  // The base match() above is purely string-based: a student who answers with a
  // valid but different verb form than the authored answer (走る vs 走ります,
  // 見て vs 見た) is wrongly rejected. We don't have a deconjugator, but we don't
  // need one — the answer's words are already known by dictionary id (lessons:
  // q.a_terms; stories: q.aTerms). For each conjugatable word we FORWARD-generate
  // every valid form and accept if the student used any of them. Additive only:
  // this runs AFTER the base checks, so it can only grant acceptance.

  // Verb / i-adj / na-adj classes that conjugate (mirror tokenize.mjs/conjugate).
  var CONJ_GTYPES = { verb:1, godan:1, ichidan:1, suru:1, kuru:1, irr_iku:1, irr_aru:1,
    noun_suru:1, u:1, ru:1, adjective:1, 'i-adj':1, i_adj:1, 'i-adjective':1, adjective_i:1,
    irr_ii:1, 'na-adjective':1, 'na-adj':1, na_adj:1, adjective_na:1 };
  // Conjugatable words that carry no standalone content — a student may omit
  // them, so they're never *required*: aspect/existence auxiliaries (ている/てくる/
  // てある) and the generic light verb する (it attaches to a noun that carries the
  // meaning; requiring a bare する would false-accept any noun+した answer).
  var OPTIONAL_VERB_IDS = { v_iru:1, v_kuru:1, v_aru:1, v_suru:1 };

  function isConjugatable(entry) {
    if (!entry) return false;
    return !!(CONJ_GTYPES[entry.gtype] || CONJ_GTYPES[entry.verb_class]);
  }

  // All inflected surfaces+readings of a conjugatable entry, normalized for
  // comparison (NFKC, no spaces, katakana→hiragana), de-duped, length ≥ 2.
  function allForms(entry, conjugate, rules) {
    var seen = {}, res = [];
    var add = function (s) {
      var n = s ? kataToHira(normAns(s)) : '';
      if (n && n.length >= 2 && !seen[n]) { seen[n] = 1; res.push(n); }
    };
    add(entry.surface); add(entry.reading);
    if (conjugate && rules) {
      for (var key in rules) {
        var c = null;
        try { c = conjugate(entry, key, rules); } catch (e) { c = null; }
        if (c) { add(c.surface); add(c.reading); }
      }
    }
    return res;
  }

  // sk = normalized (kata→hira) student input. terms = q.answerTerms: array of
  // string ids or {id,form}/{g} objects. opt: {conjugate, rules, termMap, getRoot}.
  // The answer's PREDICATES (verbs + adjectives, minus the optional auxiliaries)
  // are REQUIRED — each must appear in the student's input in ANY valid form.
  // Everything else (nouns, adverbs like 少し, particles, copula, です/ます, and
  // ている/てくる/てある/する) is OPTIONAL, matching the chosen leniency: accept
  // any conjugation and let the student drop politeness/aux. A wrong predicate
  // (歩く for an answer about 走る) still fails. Needs ≥1 required predicate.
  function matchByTerms(sk, terms, opt) {
    if (!sk || !terms || !terms.length || !opt) return false;
    var termMap = opt.termMap || {};
    var getRoot = opt.getRoot;
    var anyRequired = false;
    for (var i = 0; i < terms.length; i++) {
      var term = terms[i];
      var id = (typeof term === 'string') ? term : (term && (term.id || term.g));
      if (!id) continue;
      // getRoot may return an id STRING or the resolved term OBJECT (the runtime
      // getRootTerm returns the object). Normalize to an id string — otherwise the
      // OPTIONAL_VERB_IDS[rootId] check below silently fails on an object key and
      // an auxiliary (いる/くる) is wrongly treated as required.
      var rootId = id;
      if (typeof getRoot === 'function') {
        var r = getRoot(id, termMap);
        if (typeof r === 'string' && r) rootId = r;
        else if (r && r.id) rootId = r.id;
      }
      var entry = termMap[rootId] || termMap[id];
      if (!entry) continue;                 // unresolved → ignore (lenient)
      if (!isConjugatable(entry)) continue; // noun/adverb/particle/copula → optional
      if (OPTIONAL_VERB_IDS[rootId]) continue;   // aux verb / する → optional
      anyRequired = true;
      var ok = false;
      var forms = allForms(entry, opt.conjugate, opt.rules);
      for (var f = 0; f < forms.length; f++) {
        if (sk.indexOf(forms[f]) !== -1) { ok = true; break; }
      }
      if (!ok) return false;
    }
    return anyRequired;
  }

  // Hybrid lenient match: exact (normalized) match; or a substantial subset of
  // the model answer in either direction (kanji or 2+ chars, so a lone particle
  // never passes); or contains an authored `accept` core; or a KANA answer that
  // equals/contains the kana reading of the kanji model/accept (あおい ⇄ 青);
  // or — when answer-term metadata + the conjugation engine are supplied — every
  // required content word appears in any valid conjugation.
  // q: { answer:string, accept?:string[], answerTerms?:Array }.
  // opt: a readingFn (legacy) OR { readingFn, conjugate, rules, termMap, getRoot }.
  function match(student, q, opt) {
    var readingFn = (typeof opt === 'function') ? opt : (opt && opt.readingFn);
    var ns = normAns(student);
    if (!ns) return false;
    var na = normAns(q && q.answer);
    if (na && ns === na) return true;
    var substantial = ns.length >= 2 || hasKanji(ns);
    if (substantial && na && (na.indexOf(ns) !== -1 || ns.indexOf(na) !== -1)) return true;
    var accept = (q && q.accept) || [];
    for (var a = 0; a < accept.length; a++) {
      var nk = normAns(accept[a]);
      if (nk && ns.indexOf(nk) !== -1) return true;
    }
    if (typeof readingFn === 'function') {
      var sk0 = kataToHira(ns);
      if (sk0.length >= 2) {
        var targets = [na].concat(accept).filter(Boolean);
        for (var t = 0; t < targets.length; t++) {
          var rk = readingFn(normAns(targets[t]));
          if (rk && rk.length >= 2 && (rk === sk0 || rk.indexOf(sk0) !== -1 || sk0.indexOf(rk) !== -1)) return true;
        }
      }
    }
    // Conjugation-tolerant layer (only when caller supplies the engine + terms).
    var terms = q && (q.answerTerms || q.aTerms || q.a_terms);
    if (terms && opt && typeof opt === 'object' && opt.conjugate && opt.rules && opt.termMap) {
      if (matchByTerms(kataToHira(ns), terms, opt)) return true;
    }
    return false;
  }

  window.JPShared.writtenAnswer = {
    normAns: normAns,
    hasKanji: hasKanji,
    kataToHira: kataToHira,
    makeReadingFn: makeReadingFn,
    pairsFromTermMap: pairsFromTermMap,
    allForms: allForms,
    matchByTerms: matchByTerms,
    match: match
  };
})();
