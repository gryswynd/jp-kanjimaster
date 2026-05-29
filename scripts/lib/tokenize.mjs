/**
 * scripts/lib/tokenize.mjs
 *
 * Canonical tokenization for Japanese text against a glossary index.
 *
 * Two entry points:
 *   - deriveTokens(surface, reading)  → smart split of a word-level
 *     (surface, reading) pair into [{k}, {k,r}, ...] tokens. Used by the
 *     glossary derive script (one entry at a time).
 *   - tokenizeText(text, glossaryIndex) → greedy longest-match segmentation
 *     of a free-text Japanese string against a surface→entry index. Used by
 *     the story migration + paragraph authoring scripts (per paragraph).
 *
 * Both share the same {k, r} shape that JPShared.jpText.render consumes at
 * runtime. The renderer is the source of truth for display; this lib is the
 * source of truth for data shape.
 *
 * NEVER hand-edit tokens. Always go through one of these two paths.
 */

// ── Unicode helpers ─────────────────────────────────────────────────────────

export const HIRAGANA_RE = /[぀-ゟ]/;
export const KATAKANA_RE = /[゠-ヿ]/;
export const KANJI_RE    = /[一-鿿㐀-䶿]/;

export function isKana(ch)  { return HIRAGANA_RE.test(ch) || KATAKANA_RE.test(ch); }
export function hasKanji(s) { return KANJI_RE.test(s || ''); }

// Level/lesson preference. When two entries claim the same surface, the
// EARLIER-taught one wins — e.g. v_tokoro (N4.9, "place") wins over
// v_tokoro_2 (N3.18, "point in time") for the kana surface ところ. Vocab
// always beats kanji-card entries (kun-form readings mislead).
function lessonRank(e) {
  if (!e) return 999;
  const s = (typeof e.lesson_ids === 'string' && e.lesson_ids) ||
            (typeof e.lesson === 'string' && e.lesson) ||
            (typeof e.introducedIn === 'string' && e.introducedIn) || '';
  const m = s.match(/^N([345])\.(\d+)/);
  if (!m) return 998;
  // N5=0..99, N4=100..199, N3=200..299
  return (5 - Number(m[1])) * 100 + Number(m[2]);
}
function preferableTo(candidate, incumbent) {
  if (!incumbent) return true;
  // Vocab > kanji-card always.
  if (incumbent.type === 'kanji' && candidate.type === 'vocab') return true;
  if (candidate.type === 'kanji' && incumbent.type === 'vocab') return false;
  return lessonRank(candidate) < lessonRank(incumbent);
}

// Detect "kanji-card template" reading strings that aren't suitable for
// runtime furigana — these come from kanji-flashcard entries authored with
// kun-form memos (e.g. "おも(う)", "い/はい", "おも / かさ", "で;だ",
// "いちにち/ついたち"). Leaking them into rendered ruby produces literal
// "おも(う)" furigana, which is wrong. The intended single reading lives
// in a sibling vocab entry; skipping these lets the sibling win.
export function isTemplateReading(s) {
  if (!s) return false;
  return /[()（）/／;；]/.test(s) || /\s{1,}/.test(s);
}

// ── Smart split: word-level (surface, reading) → tokens[] ───────────────────
//
// surface "お父さん" + reading "おとうさん"
//   → [{k:"お"}, {k:"父", r:"とう"}, {k:"さん"}]
//
// surface "学生" + reading "がくせい"
//   → [{k:"学生", r:"がくせい"}]
//
// surface == reading (all-kana, matches): returns null (no tokens needed,
// renderer falls back to plain string).

export function deriveTokens(surface, reading) {
  if (!surface || !reading) return null;
  if (surface === reading) return null;
  // Skip template-form readings — they'd produce nonsense furigana like
  // "おも(う)" or "い/はい". The intended single reading lives in a sibling
  // entry (or needs to be authored explicitly).
  if (isTemplateReading(reading)) return null;

  // Match kana prefix common to both strings.
  let pre = 0;
  while (
    pre < surface.length && pre < reading.length &&
    surface[pre] === reading[pre] && isKana(surface[pre])
  ) pre++;

  // Match kana suffix common to both, not overlapping the prefix.
  let post = 0;
  while (
    post < surface.length - pre && post < reading.length - pre &&
    surface[surface.length - 1 - post] === reading[reading.length - 1 - post] &&
    isKana(surface[surface.length - 1 - post])
  ) post++;

  const preStr  = surface.slice(0, pre);
  const postStr = surface.slice(surface.length - post);
  const midK    = surface.slice(pre, surface.length - post);
  const midR    = reading.slice(pre, reading.length - post);

  const tokens = [];
  if (preStr) tokens.push({ k: preStr });
  if (midK) {
    if (midR && midR !== midK) {
      // If the middle is multiple kanji with no interior kana, we still emit
      // it as a single bundled token — splitting kanji-run readings without
      // explicit per-char authoring would guess wrong (e.g. 大通 → おおどお;
      // we can't safely split into 大=おお / 通=どお without knowing the
      // boundary). For now, output the bundle and let an author hand-split
      // later if needed. If the middle is mixed (kanji + interior kana,
      // e.g. 大きい → 大き), we still emit one bundle for the same reason.
      tokens.push({ k: midK, r: midR });
    } else {
      tokens.push({ k: midK });
    }
  }
  if (postStr) tokens.push({ k: postStr });
  return tokens.length ? tokens : null;
}

// ── Build a surface→entry index from glossary + particle files ──────────────
//
// Returned Map preserves insertion order — we sort by length DESC so the
// greedy tokenizer prefers the longest match. Pass an array of paths; each
// file is loaded and walked.

// Conjugation engine — lazy import so the lib stays usable without it.
let _conjugateMod = null;
async function loadConjugate() {
  if (_conjugateMod) return _conjugateMod;
  _conjugateMod = await import('./conjugate.mjs');
  return _conjugateMod;
}

export async function buildGlossaryIndex(jsonPaths, readFile, opts) {
  opts = opts || {};
  const idx = new Map();
  // Track which keys are "reading-only" matches (kana form of a kanji entry).
  // The tokenizer needs to know NOT to splice the entry's authored tokens
  // for these — those tokens would re-introduce the kanji form into prose
  // that was written in kana.
  const readingOnlyKeys = new Set();

  for (const p of jsonPaths) {
    const raw = await readFile(p, 'utf8');
    const data = JSON.parse(raw);

    if (Array.isArray(data.entries)) {
      for (const e of data.entries) {
        // Skip entries with template-style readings — kun-form memos like
        // "おも(う)", "い/はい", "で;だ". They produce nonsense furigana
        // when leaked into prose. The intended reading lives in a sibling
        // vocab entry; skipping the kun entry lets the vocab entry win.
        if (isTemplateReading(e.reading)) continue;
        const surface = e.surface;
        if (surface) {
          const existing = idx.get(surface);
          // Prefer type="vocab" over type="kanji" — kanji-card entries
          // carry per-character readings (千→ち, 千's kun) that mislead
          // standalone usage (千 as a number = せん). Vocab entries carry
          // the contextual / standalone reading. Other types (particle,
          // character) handled in their own loops below.
          if (!existing || (existing.type === 'kanji' && e.type === 'vocab')) {
            idx.set(surface, e);
          }
        }
        // Also index by reading when reading differs from surface — lets
        // prose like "わたし" (kana for 私) get tagged via the 私 entry.
        // MIN LENGTH 4: shorter readings cause false-positive matches when
        // their kana sequence collides with conjugation continuations.
        // E.g. v_shitei (指定, してい) collided with する→して + います;
        // v_shiyou (使用, しよう) collided with する→しよう plain-volitional.
        // For legitimate 2–3 char kana variants (まえ, となり, すき), add
        // them explicitly via the entry's `matches[]` field — that path
        // is authored intent, not auto-derived.
        if (opts.includeReadings && e.reading && e.reading.length >= 4 && e.reading !== surface && !idx.has(e.reading)) {
          idx.set(e.reading, e);
          readingOnlyKeys.add(e.reading);
        }
      }
    }
    if (Array.isArray(data.particles)) {
      for (const p of data.particles) {
        const k = p.particle;
        if (k && !idx.has(k)) idx.set(k, p);
      }
    }
    if (Array.isArray(data.characters)) {
      // Character names from characters.json (Rikizo, Yamakawa, etc.). Each
      // character has a primary `surface` plus a `matches` array of alternate
      // spellings (e.g. char_ken: surface=けん, matches=['ケン']).
      for (const c of data.characters) {
        const adapted = { id: c.id, surface: c.surface || c.name, reading: c.reading || c.surface, meaning: c.meaning || c.name || '', type: 'character' };
        const variants = new Set();
        if (c.surface) variants.add(c.surface);
        if (c.name) variants.add(c.name);
        if (Array.isArray(c.matches)) for (const m of c.matches) variants.add(m);
        for (const k of variants) {
          if (k && !idx.has(k)) idx.set(k, adapted);
        }
      }
    }
  }

  // OPTIONAL: pre-generate conjugated forms via the shared conjugation engine.
  // When `opts.conjugationRules` is provided, for every verb / i-adj / na-adj
  // glossary entry we generate the most common inflected forms (うれしい →
  // うれしかった, 食べる → 食べました, etc.) and add them as synthetic surface
  // entries. The tokenizer then matches the WHOLE inflected form as a tappable
  // chip whose term-id resolves through `JP_OPEN_TERM(id, form, …)`.
  if (opts.conjugationRules) {
    const { conjugate, VERB_FORMS, I_ADJ_FORMS, NA_ADJ_FORMS, COPULA_FORMS } = await loadConjugate();
    const VERB_GTYPES = new Set(['verb', 'godan', 'ichidan', 'suru', 'kuru', 'irr_iku', 'irr_aru', 'noun_suru']);
    const IADJ_GTYPES = new Set(['adjective', 'i-adj', 'i_adj', 'i-adjective', 'adjective_i', 'irr_ii']);
    const NAADJ_GTYPES = new Set(['na-adjective', 'na-adj', 'na_adj', 'adjective_na']);

    // Collect a snapshot of the current root entries to conjugate.
    const roots = [];
    for (const [, e] of idx) {
      const gt = e.gtype;
      const v = e.verb_class || gt;
      if (v === 'copula') { roots.push({ entry: e, forms: COPULA_FORMS }); continue; }
      if (!gt) continue;
      if (VERB_GTYPES.has(gt) || VERB_GTYPES.has(v)) roots.push({ entry: e, forms: VERB_FORMS });
      else if (IADJ_GTYPES.has(gt)) roots.push({ entry: e, forms: I_ADJ_FORMS });
      else if (NAADJ_GTYPES.has(gt)) roots.push({ entry: e, forms: NA_ADJ_FORMS });
    }

    // Multi-step rule keys (passive/causative/potential variants) chain on
    // top of a base inflection. Their kanji-bearing surface is fine to index
    // (教えられた / 着かれて — disambiguated by the kanji root), but their
    // kana-only reading often coincides with a different root's simpler form
    // (e.g. v_tsuku.passive_te 着かれて → reading つかれて collides with
    // v_tsukareru.te_form つかれて). Suppress the reading-only auto-index for
    // these so the single-step root form wins the kana lookup.
    const MULTI_STEP_PREFIXES = ['passive', 'causative', 'polite_passive', 'plain_passive',
                                 'polite_causative', 'plain_causative', 'plain_short_causative',
                                 'potential_te'];
    function isMultiStep(ruleKey) {
      return MULTI_STEP_PREFIXES.some(p => ruleKey === p || ruleKey.startsWith(p + '_'));
    }

    let conjugated = 0;
    for (const { entry, forms } of roots) {
      for (const form of forms) {
        const synth = conjugate(entry, form, opts.conjugationRules);
        if (!synth || !synth.surface) continue;
        const tokens = deriveTokens(synth.surface, synth.reading) || [{ k: synth.surface }];
        synth.tokens = tokens;
        synth.type = 'inflected';
        if (!idx.has(synth.surface)) {
          idx.set(synth.surface, synth);
          conjugated++;
        } else {
          // Surface collision: prefer single-step synth over multi-step.
          // Common case: v_suru.potential_te = できて collides with
          // v_dekiru.te_form = できて. v_dekiru.te_form is the natural
          // tokenization (and earlier-introduced grammar).
          const existing = idx.get(synth.surface);
          if (existing && existing.type === 'inflected' && existing._ruleKey &&
              isMultiStep(existing._ruleKey) && !isMultiStep(form)) {
            idx.set(synth.surface, synth);
          }
        }
        // ALSO index by reading when reading differs from surface — stories
        // sometimes write the kana spelling of a kanji-bearing inflected form
        // (e.g. prose has "ほしくない" not "欲しくない"). EXCEPTION: multi-step
        // forms (passive/causative chains) don't auto-index by reading, to
        // avoid kana-collision with single-step forms of other roots.
        if (opts.includeReadings && synth.reading && synth.reading !== synth.surface && !idx.has(synth.reading) && !isMultiStep(form)) {
          idx.set(synth.reading, synth);
          readingOnlyKeys.add(synth.reading);
          conjugated++;
        }
      }
    }
    if (opts.verbose) console.log(`[buildGlossaryIndex] added ${conjugated} inflected surfaces from ${roots.length} roots`);
  }

  // PASS 3: authored kana variants in `matches[]` (e.g. v_suki.matches=["すき"],
  // v_yoi.matches=["よかった"]). These are intentional spelling alternates,
  // indexed AFTER the conjugation pass so inflected synthetic entries
  // (v_yoi_plain_past_adj) win for surfaces that overlap an authored match —
  // we want a conjugated chip to open the conjugation modal, not the root.
  // Tracked in a separate Set (not readingOnlyKeys) because authored matches
  // SHOULD chip to the entry — unlike auto-derived reading-only matches.
  const matchesKeys = new Set();
  if (opts.includeReadings) {
    for (const p of jsonPaths) {
      const raw = await readFile(p, 'utf8');
      const data = JSON.parse(raw);

      // Vocab/grammar entries: e.matches[] — kana-hybrid spelling alternates.
      if (Array.isArray(data.entries)) {
        for (const e of data.entries) {
          if (isTemplateReading(e.reading)) continue;
          if (!Array.isArray(e.matches)) continue;
          // Collect the kanji set of the entry's surface — used to filter
          // matches[] aliases. A legitimate kana-hybrid match (友だち / 友達)
          // shares all its kanji with the surface. An illegitimate "composite"
          // match (v_en.matches=["百円"] where v_en.surface="円") introduces
          // foreign kanji (百) that wouldn't get proper furigana if grouped
          // under the alias. Skip those — let the char-by-char tokenizer
          // handle the compound via the individual entries (v_hyaku + v_en).
          const surfaceKanji = new Set();
          if (typeof e.surface === 'string') {
            for (const ch of e.surface) if (/[一-鿿]/.test(ch)) surfaceKanji.add(ch);
          }
          for (const m of e.matches) {
            if (!m || m === e.surface) continue;
            let foreignKanji = false;
            for (const ch of m) {
              if (/[一-鿿]/.test(ch) && !surfaceKanji.has(ch)) { foreignKanji = true; break; }
            }
            if (foreignKanji) continue;
            // Override an already-indexed entry IFF the existing one is
            // taught LATER. Otherwise a kana-surface N3 entry would shadow
            // an N4/N5 vocab's authored kana alias (v_tokoro_2 ところ N3
            // vs v_tokoro.matches=["ところ"] N4).
            if (idx.has(m) && !preferableTo(e, idx.get(m))) continue;
            idx.set(m, e);
            matchesKeys.add(m);
          }
        }
      }

      // Particle entries: p.matches[] — alternate spellings of compound
      // particles (p_ndesu.matches = ["のです", ...]). Particles always
      // emit as the entry itself; no surface/kanji filter needed.
      if (Array.isArray(data.particles)) {
        for (const p of data.particles) {
          if (!Array.isArray(p.matches)) continue;
          for (const m of p.matches) {
            if (!m || m === p.particle || idx.has(m)) continue;
            idx.set(m, p);
            matchesKeys.add(m);
          }
        }
      }
    }
  }

  // Sort by surface length DESC so longest matches win during greedy tokenize.
  const sorted = new Map(
    Array.from(idx.entries()).sort((a, b) => b[0].length - a[0].length)
  );
  // Attach metadata so consumers can check for reading-only matches.
  sorted._readingOnlyKeys = readingOnlyKeys;
  sorted._matchesKeys = matchesKeys;
  return sorted;
}

// Particles with surface-vs-pronunciation disambiguation. Their reading in
// particles.json is the literal kana, but the actual pronunciation differs.
// When tokenizing, we attach the corrected reading so romaji mode renders
// "wa" / "e" / "o" instead of "ha" / "he" / "wo". Furigana never shows
// (the renderer skips kana surfaces).
const PARTICLE_PRONUNCIATIONS = {
  p_wa:           'わ',  // topic particle は → wa
  p_e:            'え',  // direction particle へ → e
  p_wo:           'お'   // object particle を → o
};

// Surfaces that ALWAYS match regardless of word-boundary state. These are
// the disambiguation particles, which are unambiguously particle-only when
// they appear — they're never embedded inside another word once the major
// kana words are in the glossary index. Lets us recover には as に+は
// instead of に + (bare は).
const BOUNDARY_OVERRIDES = new Set(['は', 'へ', 'を']);

// ── Free-text segmentation: greedy longest-match over a glossary index ──────
//
// Returns an array of tokens covering the entire input text. Matched surfaces
// emit their authored tokens (from glossary). Unmatched runs emit per-char
// fallback tokens with no reading — the renderer will display them bare.
//
// glossaryIndex: Map<surface, glossaryEntry> sorted by surface length DESC.
//                Each entry MUST have a `tokens` array (added by the derive
//                script) for the matched output to carry readings.

export function tokenizeText(text, glossaryIndex) {
  if (!text) return [];

  // Index by first char. Longest match wins (the glossaryIndex was already
  // sorted by surface length DESC). Single-kana surfaces (は, の, が,
  // particles) are INCLUDED — fragmentation risk is mitigated because
  // multi-char kana words (わたし, かぞく, ケン, etc.) are also indexed,
  // and greedy longest-match consumes them before single-kana fallback.
  const byFirstChar = new Map();
  for (const [surface] of glossaryIndex) {
    const c = surface[0];
    if (!byFirstChar.has(c)) byFirstChar.set(c, []);
    byFirstChar.get(c).push(surface);
  }

  const out = [];
  let unmatched = '';
  // Track whether we're at a word boundary. True at start, after a successful
  // multi-char match, or after a non-kana character (punctuation, kanji,
  // space). False mid-bare-run when accumulating kana chars — in that state
  // we DON'T allow single-kana surface matches because they'd fragment
  // unrecognized words (し inside わたし, ま inside しまう, etc.).
  let atBoundary = true;

  function flushUnmatched() {
    if (!unmatched) return;
    out.push({ k: unmatched });
    unmatched = '';
  }

  let i = 0;
  outer: while (i < text.length) {
    const ch = text[i];
    const candidates = byFirstChar.get(ch) || [];
    let matched = null;
    for (const s of candidates) {
      // Skip single-kana candidates when not at a word boundary, EXCEPT
      // the disambiguation particles (は/へ/を) which are always safe to
      // match once the major kana words are indexed.
      if (s.length === 1 && /^[぀-ヿー]+$/.test(s) && !atBoundary && !BOUNDARY_OVERRIDES.has(s)) continue;
      if (text.substring(i, i + s.length) === s) {
        matched = s;
        break;
      }
    }
    // 1-char lookahead: if the current (short multi-char) match would block
    // a STRICTLY longer multi-char match starting one char later, prefer the
    // skip. Fixes "とり (bird) + きぞう (bare)" → "と + りきぞう (Rikizo)".
    //
    // CRITICAL: only apply to multi-char (2+) matches. Single-char matches
    // (particles は/へ/を, single kanji 父/人) MUST always be kept.
    //
    // EXTRA CARE: if the FIRST char of the match-being-skipped is a known
    // disambiguation particle (は/へ/を — context: "はい (yes)" vs "は + いっしょに"),
    // emit it as a tagged particle token BEFORE skipping; otherwise it'd
    // fall through to the bare-run accumulator and lose its `r` reading.
    // Protect synthetic conjugated forms (`来て`, `行きました`, etc.) from
    // lookahead skips — they're authored linguistic units that should win
    // over any auxiliary that happens to start with the same kana run.
    const matchedEntry = matched ? glossaryIndex.get(matched) : null;
    const matchedIsConjugated = matchedEntry && matchedEntry.type === 'inflected';
    // True-particle entries (compound or single) shouldn't be peeled by
    // lookahead. んだ + けど → "explanatory + but" should stay split as
    // んだ + けど; the lookahead would otherwise drop んだ in favor of the
    // longer だけど at i+1, orphaning the ん.
    //
    // CAREFUL: the `p_` id prefix is also used for set-phrases (p_hai = はい
    // "yes", p_ohayou, p_arigatou). Those AREN'T particles and the lookahead
    // SHOULD peel them — otherwise はい (yes) consumes a boundary particle
    // は + the start of the next word (はい + ちばん instead of は + いちばん).
    // The trustworthy signal: entries that live in particles.json carry a
    // top-level `particle` field. Use that as the guard.
    const matchedIsParticle = matchedEntry && !!matchedEntry.particle;
    if (!matchedIsConjugated && !matchedIsParticle && matched && matched.length >= 2 && matched.length < 4 && i + 1 < text.length) {
      const firstIsParticle = BOUNDARY_OVERRIDES.has(matched[0]);
      // When the current match STARTS with a boundary particle (は/へ/を),
      // peel-and-skip even when the i+1 match is the same length (1+) — in
      // practice "particle + word" wins linguistically. E.g. "はここ" is
      // 99% "は (particle) + ここ (here)" not "はこ (box) + こ".
      // For matches NOT starting with a particle, only skip on strictly
      // longer i+1 match (とり vs りきぞう case).
      const nextCands = byFirstChar.get(text[i + 1]) || [];
      for (const s of nextCands) {
        if (firstIsParticle ? (s.length < 1) : (s.length <= matched.length)) break;
        if (s.length === 1 && /^[぀-ヿー]+$/.test(s) && !BOUNDARY_OVERRIDES.has(s)) continue;
        if (text.substring(i + 1, i + 1 + s.length) === s) {
          // Decide whether to drop the current match into the bare-run buffer,
          // or to peel off a leading particle and advance one char.
          const firstChar = matched[0];
          if (BOUNDARY_OVERRIDES.has(firstChar)) {
            // Peel: flush any prior unmatched, emit the particle with its
            // disambiguation reading, advance by 1, let the outer loop pick
            // up the longer match next iteration.
            flushUnmatched();
            const particleEntry = glossaryIndex.get(firstChar);
            const particleR = particleEntry && particleEntry.id && PARTICLE_PRONUNCIATIONS[particleEntry.id];
            out.push(particleR ? { k: firstChar, r: particleR } : { k: firstChar });
            i += 1;
            atBoundary = true;
            continue outer;
          }
          // No boundary-particle to peel — drop current match to bare run.
          matched = null;
          break;
        }
      }
    }
    if (matched) {
      flushUnmatched();
      const entry = glossaryIndex.get(matched);
      const isReadingOnlyMatch = glossaryIndex._readingOnlyKeys &&
                                  glossaryIndex._readingOnlyKeys.has(matched);
      const isMatchesAlias = glossaryIndex._matchesKeys &&
                              glossaryIndex._matchesKeys.has(matched);
      const matchedIsKana = /^[぀-ヿー]+$/.test(matched);
      const particleRomaji = entry.id && PARTICLE_PRONUNCIATIONS[entry.id];

      if (isMatchesAlias) {
        // Authored kana variant from entry.matches[] — the author explicitly
        // declared this surface = this entry, so chip it to entry.id (root).
        // (Inflected synthetic entries take precedence: they're indexed
        // before matches[] and would emit as type=inflected below.)
        // For kanji-bearing aliases (e.g. 朝ごはん aliased to v_asagohan
        // with reading あさごはん), derive per-char tokens so the kanji
        // 朝 gets furigana / romaji proper, instead of one combined token
        // that swallows the reading.
        const g = entry.id;
        const hasKanji = /[一-鿿]/.test(matched);
        if (hasKanji && entry.reading) {
          const derived = deriveTokens(matched, entry.reading);
          if (derived && derived.length) {
            for (const t of derived) out.push({ ...t, g });
          } else {
            out.push({ k: matched, g });
          }
        } else {
          out.push({ k: matched, g });
        }
      } else if (isReadingOnlyMatch) {
        // Matched the entry's reading (kana form), NOT the kanji surface.
        // Splicing entry.tokens here would substitute the kanji into prose
        // (and break reconstruction). Emit one bare token attached to the
        // entry id so the renderer chips it — works for both inflected
        // synthetic forms (ほしくない → v_hoshii_plain_negative) and root
        // vocab written in kana (となり → v_tonari).
        if (entry.id) {
          out.push({ k: matched, g: entry.id });
        } else {
          out.push({ k: matched });
        }
      } else if (entry.tokens && entry.tokens.length > 1 && entry.tokens.map(t=>t.k||'').join('') === matched) {
        // Multi-piece authored tokens whose reconstructed surface equals the
        // matched text. Splice them in with a group id so they render as ONE
        // clickable unit (こんにちは → [こんにち, は r=わ]; 友だち → [友, だち]).
        // Guard against drift: the tokens MUST reconstruct exactly.
        const g = entry.id;
        for (const t of entry.tokens) out.push({ ...t, g });
      } else if (entry.tokens && entry.tokens.length === 1 && entry.tokens[0].k === matched) {
        // Single-piece authored tokens — splice as-is, but attach the group
        // id for inflected entries so the renderer can resolve the term-id
        // back to its conjugation pair when opening the modal.
        if (entry.type === 'inflected' && entry.id) {
          out.push({ ...entry.tokens[0], g: entry.id });
        } else {
          out.push({ ...entry.tokens[0] });
        }
      } else if (matchedIsKana) {
        // Pure-kana surface match (particles, ケン). EXCEPTION:
        // disambiguation particles (は/へ/を) emit `r` for romaji.
        if (particleRomaji) out.push({ k: matched, r: particleRomaji });
        else out.push({ k: matched });
      } else if (entry.reading && entry.reading !== matched) {
        out.push({ k: matched, r: entry.reading });
      } else {
        out.push({ k: matched });
      }
      i += matched.length;
      // After a multi-char match → clean word boundary.
      // After a single-kanji match → also a word boundary (kanji acts as a
      // word/character separator in Japanese; e.g. 父の has の as particle
      // right after kanji).
      // After a single-kana match → NOT a boundary; we just consumed one
      // kana and the next kana might be a continuation of an unrecognized
      // word, so don't allow another single-kana match in a row.
      const matchedIsSingleKana = matched.length === 1 && /^[぀-ヿー]+$/.test(matched);
      // After a single-kana PARTICLE or COPULA match, we ARE at a word
      // boundary — particles/copulas terminate words by definition, so the
      // NEXT char is free to single-kana-match (e.g. "だね" → だ + ね).
      // For other single-kana matches (an honorific お, etc.), stay mid-word
      // to avoid fragmenting an unrecognized longer word that starts with one.
      const matchedIsParticleLike = entry && (
        (entry.id && entry.id.startsWith('p_')) ||
        entry.verb_class === 'copula' ||
        entry.type === 'particle'
      );
      atBoundary = !matchedIsSingleKana || matchedIsParticleLike;
    } else {
      // Emit punctuation as its own token, NEVER glue to a bare-run. This
      // keeps content fragments findable by the renderer's surfaceIdx
      // lookup ("わよ" can match the particle よ at render time, but
      // "わよ。」" never matches anything). Whitespace gets the same
      // treatment.
      if (/[、。！？「」『』（）：；・…\s]/.test(ch)) {
        flushUnmatched();
        out.push({ k: ch });
        atBoundary = true;
        i++;
        continue;
      }
      unmatched += ch;
      // Update boundary: after a non-kana char we re-enter a boundary state;
      // after a kana char we're mid-word and must stay non-boundary.
      atBoundary = !/[぀-ヿー]/.test(ch);
      i++;
    }
  }
  flushUnmatched();
  return out;
}

// ── Sanity: tokens concatenated must reconstruct the original text ──────────
// Used by the validator to catch tokens drifting out of sync with prose.

export function reconstructFromTokens(tokens) {
  return (tokens || []).map(t => t && typeof t === 'object' ? (t.k || '') : '').join('');
}
