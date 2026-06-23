/**
 * scripts/lib/counters.mjs
 *
 * Build-time ESM port of the runtime counter engine
 * (app/shared/counter-engine.js / app/shared/text-processor.js).
 *
 * Japanese counting is generated from counter_rules.json, NOT enumerated in the
 * glossary — so we never need a per-(number × counter) glossary entry. This lib
 * lets the tokenizer pre-generate counter surfaces into its match index the same
 * way it pre-generates conjugated verb forms: the deterministic rules ARE the
 * source of truth, and every generated term carries a `count_<n>_<counter>` id
 * that the runtime (JP_OPEN_TERM) re-derives on demand for the term popup.
 *
 * buildCounterTerm() is a line-for-line port of the runtime so build-time and
 * render-time agree on surface + reading.
 *
 * API:
 *   buildCounterTerm(counterKey, n, rules) → { id, surface, reading, meaning } | null
 *   generateCounterTerms(rules, opts?)     → [{ id, surface, reading, meaning, counterKey, n }, ...]
 */

const PLACE_ORDER = [10000, 1000, 100, 10];

// Native つ-series tops out at とお (10); past that the algorithm would emit
// nonsense like 十一つ. Cap generation for such counters at their special max.
const SPECIAL_ONLY_COUNTERS = new Set(['tsu']);

function buildNumber(n, rules) {
  if (!n || n < 1 || !Number.isInteger(n)) return null;

  let surface = '';
  let reading = '';
  let overrideKey = null;
  let remaining = n;

  for (let pi = 0; pi < PLACE_ORDER.length; pi++) {
    const place = PLACE_ORDER[pi];
    if (remaining < place) continue;

    const count = Math.floor(remaining / place);
    remaining -= count * place;
    const isLast = (remaining === 0);
    const placeData = rules.places[String(place)];
    const euphonicKey = String(count);

    if (placeData.euphonics && placeData.euphonics[euphonicKey]) {
      surface += (count > 1 ? rules.digits[euphonicKey].surface : '') + placeData.surface;
      reading += placeData.euphonics[euphonicKey];
    } else {
      if (count > 1) {
        surface += rules.digits[euphonicKey].surface;
        reading += rules.digits[euphonicKey].reading;
      }
      surface += placeData.surface;
      reading += placeData.reading;
      if (isLast && count === 1) overrideKey = String(place);
    }
  }

  if (remaining > 0) {
    const dKey = String(remaining);
    surface += rules.digits[dKey].surface;
    reading += rules.digits[dKey].reading;
    overrideKey = dKey;
  }

  return { surface, reading, overrideKey };
}

function baseReadingForKey(key, rules) {
  if (!key) return null;
  if (rules.places[key]) return rules.places[key].reading;
  if (rules.digits[key]) return rules.digits[key].reading;
  return null;
}

export function buildCounterTerm(counterKey, n, rules) {
  if (!rules || !rules.counters) return null;
  const counter = rules.counters[counterKey];
  if (!counter) return null;

  const nInt = parseInt(n, 10);
  if (!nInt || nInt < 1) return null;

  // Whole-word special cases (e.g. 一人=ひとり, 二人=ふたり, 七つ=ななつ).
  if (counter.special && counter.special[String(nInt)]) {
    const sp = counter.special[String(nInt)];
    return {
      id: 'count_' + nInt + '_' + counterKey,
      surface: sp.surface,
      reading: sp.reading,
      meaning: nInt + ' ' + counter.meaning
    };
  }

  const num = buildNumber(nInt, rules);
  if (!num) return null;

  const overrideKey = num.overrideKey;
  let numReading = num.reading;

  if (overrideKey && counter.prefix_overrides && counter.prefix_overrides[overrideKey]) {
    const origBase = baseReadingForKey(overrideKey, rules);
    if (origBase && numReading.length >= origBase.length &&
        numReading.slice(-origBase.length) === origBase) {
      numReading = numReading.slice(0, -origBase.length) + counter.prefix_overrides[overrideKey];
    }
  }

  let counterReading = counter.reading;
  if (overrideKey && counter.counter_overrides && counter.counter_overrides[overrideKey]) {
    counterReading = counter.counter_overrides[overrideKey];
  }

  return {
    id: 'count_' + nInt + '_' + counterKey,
    surface: num.surface + counter.surface,
    reading: numReading + counterReading,
    meaning: nInt + ' ' + counter.meaning
  };
}

/**
 * Generate every counter surface the tokenizer should recognize. Mirrors the
 * conjugation pre-generation: a bounded, deterministic set of forms baked into
 * the match index. Covers small-number counting (the overwhelming majority of
 * story/lesson text); the runtime engine still resolves ANY n for the popup.
 *
 * opts.maxN — generic ceiling per counter (default 99). Counters in
 *             SPECIAL_ONLY_COUNTERS only emit their `special` range.
 */
export function generateCounterTerms(rules, opts = {}) {
  const maxN = opts.maxN || 99;
  const out = [];
  if (!rules || !rules.counters) return out;

  for (const counterKey of Object.keys(rules.counters)) {
    const counter = rules.counters[counterKey];
    const specialKeys = counter.special ? Object.keys(counter.special).map(Number) : [];
    const specialMax = specialKeys.length ? Math.max(...specialKeys) : 0;
    const ceiling = SPECIAL_ONLY_COUNTERS.has(counterKey) ? specialMax : maxN;

    for (let n = 1; n <= ceiling; n++) {
      const term = buildCounterTerm(counterKey, n, rules);
      if (!term || !term.surface) continue;
      out.push({ ...term, counterKey, n });
    }
  }
  return out;
}
