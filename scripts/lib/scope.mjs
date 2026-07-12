/**
 * scripts/lib/scope.mjs
 *
 * Curriculum-scope helpers shared by the content QA gates (qa-story.mjs,
 * qa-content.mjs). Extracted so the story gate and the lesson/grammar/review
 * gate can never drift on what "taught by lesson X" means.
 *
 * Ordering model: "N5.7" → { lvl:'N5', idx:7 }; levels rank N5 < N4 < N3
 * (taught earliest first). A ceiling is a parsed lesson id; `inScope(a, c)`
 * answers "is `a` taught no later than `c`".
 */

export const LEVEL_RANK = { N5: 0, N4: 1, N3: 2 };

// "N5.7" → { lvl: 'N5', idx: 7 } | null
export function parseLessonId(s) {
  if (!s || typeof s !== 'string') return null;
  const m = s.match(/^(N[345])\.(\d+)$/);
  if (!m) return null;
  return { lvl: m[1], idx: Number(m[2]) };
}

// True if `a` is taught no later than `ceiling`.
export function inScope(a, ceiling) {
  if (!a) return true;            // untagged ids aren't a scope violation
  if (!ceiling) return true;      // no ceiling = level wildcard, accept all
  const ra = LEVEL_RANK[a.lvl] ?? 99;
  const rc = LEVEL_RANK[ceiling.lvl] ?? 99;
  if (ra < rc) return true;
  if (ra > rc) return false;
  return a.idx <= ceiling.idx;
}

// Cumulative kanji taught through ceiling (N5 all + N4.1..idx if ceiling is N4),
// read from the manifest lesson entries' `kanji` arrays (the authoritative set).
export function buildTaughtKanji(manifest, ceiling) {
  const set = new Set();
  for (const lvl of ['N5', 'N4', 'N3']) {
    const data = manifest.data && manifest.data[lvl];
    if (!data) continue;
    for (const lesson of data.lessons || []) {
      const lid = parseLessonId(lesson.id);
      if (!lid) continue;
      if (!inScope(lid, ceiling)) continue;
      for (const k of lesson.kanji || []) set.add(k);
    }
  }
  return set;
}

// Look up an entry's teaching point for scope checks.
// Vocab: lesson_ids "N5.3" (string, possibly multi — the EARLIEST id wins:
// a two-tier word like 名前 "N5.1,N5.9" is first taught at N5.1); kanji
// cards: lesson; particles/characters/inflected: introducedIn.
export function entryLessonId(e) {
  if (!e) return null;
  if (typeof e.lesson_ids === 'string') {
    let best = null;
    for (const part of e.lesson_ids.split(/[,;\s]+/)) {
      const parsed = parseLessonId(part);
      if (!parsed) continue;
      if (!best || inScope(parsed, best)) best = parsed;   // keep the earliest
    }
    if (best) return best;
  }
  if (typeof e.lesson === 'string') {
    const p = parseLessonId(e.lesson);
    if (p) return p;
  }
  if (typeof e.introducedIn === 'string') {
    const p = parseLessonId(e.introducedIn);
    if (p) return p;
  }
  return null;
}

// Parse an inflected synth entry → form key + scope verdict against the rules.
export function synthFormScope(entry, ceiling, conjugationRules) {
  if (!entry || entry.type !== 'inflected') return null;
  const formKey = entry._ruleKey;
  if (!formKey) return null;
  const rule = conjugationRules[formKey];
  if (!rule) return { formKey, intro: null, violation: false };
  const intro = parseLessonId(rule.introducedIn);
  return {
    formKey,
    intro,
    violation: intro && !inScope(intro, ceiling)
  };
}

const KANA_ONLY = /^[぀-ヿー]+$/;
const PUNCT_ONLY = /^[、。！？「」『』（）：；・…\s「」\-—()『』.]+$/;

/**
 * Build a token classifier bound to a surface index + reverse id index.
 * Mirrors what the runtime renderer resolves: explicit g ids first (including
 * homograph-loser synth ids parsed as <root>_<formKey>), then surface lookup,
 * then bare single kana (particle/sound), else an untagged content token.
 */
export function makeClassifyToken({ surfaceIdx, idIdx }) {
  return function classifyToken(t) {
    const k = t.k || '';
    if (!k) return { kind: 'empty' };
    if (PUNCT_ONLY.test(k)) return { kind: 'punct' };
    if (t.g) {
      const entry = idIdx.get(t.g);
      if (!entry) {
        // A synth id that lost its surface slot to a homograph sibling
        // (v_hiraku_te_form loses 開いて to v_aku_2_te_form) is still a legal
        // tag. Parse as <root>_<formKey> by trying every prefix that is a
        // known id, longest first (ids themselves contain underscores).
        const parts = t.g.split('_');
        for (let n = parts.length - 1; n >= 1; n--) {
          const rootId = parts.slice(0, n).join('_');
          const root = idIdx.get(rootId);
          if (root) {
            const formKey = parts.slice(n).join('_');
            return { kind: 'g', g: t.g, entry: { ...root, _ruleKey: formKey, original_id: rootId } };
          }
        }
        return { kind: 'g-unknown', g: t.g, root: null };
      }
      return { kind: 'g', g: t.g, entry };
    }
    const entry = surfaceIdx.get(k);
    if (entry && entry.id) return { kind: 'surface', g: entry.id, entry };
    if (k.length === 1 && KANA_ONLY.test(k)) return { kind: 'bare-kana' };
    return { kind: 'untagged', k };
  };
}
