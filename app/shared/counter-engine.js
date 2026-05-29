/**
 * app/shared/counter-engine.js
 * Generates surface (kanji) + reading (hiragana) for any number+counter pair.
 * Rules are loaded from counter_rules.json.
 *
 * API:
 *   window.JPShared.counterEngine.buildCounterTerm(counterKey, n, rules)
 *   → { id, surface, reading, meaning }  or  null on failure
 *
 * Term refs in lesson/review JSON:
 *   { "counter": "ji", "n": 8 }  →  八時 / はちじ / "8 o'clock"
 *   { "counter": "fun", "n": 30 } →  三十分 / さんじゅうふん / "30 minutes"
 *
 * Number algorithm:
 *   Decomposes n into 万/千/百/十/units places, applies per-place euphonic
 *   overrides (e.g. 三百→さんびゃく, 六百→ろっぴゃく), then applies the
 *   counter's prefix_overrides and counter_overrides based on the final
 *   (units) component to produce the correct spoken form.
 */
(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  var PLACE_ORDER = [10000, 1000, 100, 10];

  // ---------------------------------------------------------------------------
  // buildNumber(n, rules)
  //
  // Decomposes integer n and returns:
  //   surface     — kanji string  (e.g. "三十三")
  //   reading     — hiragana string (e.g. "さんじゅうさん")
  //   overrideKey — key for counter prefix/suffix lookup:
  //                   String(unitsDigit)  when units > 0         ("8", "6", …)
  //                   "10"               when last component is
  //                                      standalone 十 (n===10,
  //                                      110, etc. — count===1)
  //                   null               otherwise (ends in 百/千,
  //                                      euphonic combo, or round tens)
  // ---------------------------------------------------------------------------
  function buildNumber(n, rules) {
    if (!n || n < 1 || !Number.isInteger(n)) return null;

    var surface = '';
    var reading = '';
    var overrideKey = null;
    var remaining = n;

    for (var pi = 0; pi < PLACE_ORDER.length; pi++) {
      var place = PLACE_ORDER[pi];
      if (remaining < place) continue;

      var count = Math.floor(remaining / place);
      remaining -= count * place;
      var isLast = (remaining === 0);
      var placeData = rules.places[String(place)];
      var euphonicKey = String(count);

      if (placeData.euphonics && placeData.euphonics[euphonicKey]) {
        // Whole digit+place euphonic replacement (e.g. 6+百 → ろっぴゃく)
        surface += (count > 1 ? rules.digits[euphonicKey].surface : '') + placeData.surface;
        reading += placeData.euphonics[euphonicKey];
        // overrideKey stays null — the euphonic has already handled any
        // prefix hardening; the counter appends normally afterwards.
      } else {
        if (count > 1) {
          surface += rules.digits[euphonicKey].surface;
          reading += rules.digits[euphonicKey].reading;
        }
        surface += placeData.surface;
        reading += placeData.reading;
        // Standalone place component (count===1, nothing follows):
        // mark it so the counter combiner can apply a prefix_override.
        if (isLast && count === 1) {
          overrideKey = String(place); // "10", "100", "1000", "10000"
        }
      }
    }

    // Units digit
    if (remaining > 0) {
      var dKey = String(remaining);
      surface += rules.digits[dKey].surface;
      reading += rules.digits[dKey].reading;
      overrideKey = dKey;
    }

    return { surface: surface, reading: reading, overrideKey: overrideKey };
  }

  // ---------------------------------------------------------------------------
  // baseReadingForKey(key, rules)
  //
  // Returns the plain hiragana reading for overrideKey so the combiner knows
  // which suffix to replace.  E.g. "8" → "はち", "10" → "じゅう".
  // ---------------------------------------------------------------------------
  function baseReadingForKey(key, rules) {
    if (!key) return null;
    if (rules.places[key]) return rules.places[key].reading;
    if (rules.digits[key]) return rules.digits[key].reading;
    return null;
  }

  // ---------------------------------------------------------------------------
  // buildCounterTerm(counterKey, n, rules)
  //
  // Public entry point.  Returns a synthetic term object ready for termMap,
  // or null if counterKey is unknown or n is invalid.
  // ---------------------------------------------------------------------------
  function buildCounterTerm(counterKey, n, rules) {
    if (!rules || !rules.counters) return null;
    var counter = rules.counters[counterKey];
    if (!counter) return null;

    var nInt = parseInt(n, 10);
    if (!nInt || nInt < 1) return null;

    // Whole-word special cases (e.g. 一人=ひとり, 二人=ふたり)
    if (counter.special && counter.special[String(nInt)]) {
      var sp = counter.special[String(nInt)];
      return {
        id:      'count_' + nInt + '_' + counterKey,
        surface: sp.surface,
        reading: sp.reading,
        meaning: nInt + ' ' + counter.meaning
      };
    }

    var num = buildNumber(nInt, rules);
    if (!num) return null;

    var overrideKey = num.overrideKey;
    var numReading  = num.reading;

    // Apply prefix_override: replaces the final component's reading.
    // E.g. overrideKey="4", counter="ji" → replace "よん" with "よ" → "よじ"
    if (overrideKey && counter.prefix_overrides && counter.prefix_overrides[overrideKey]) {
      var origBase = baseReadingForKey(overrideKey, rules);
      if (origBase && numReading.length >= origBase.length &&
          numReading.slice(-origBase.length) === origBase) {
        numReading = numReading.slice(0, -origBase.length) +
                     counter.prefix_overrides[overrideKey];
      }
    }

    // Apply counter_override: swaps the counter suffix reading.
    // E.g. overrideKey="6", counter="fun" → "ふん" → "ぷん"
    var counterReading = counter.reading;
    if (overrideKey && counter.counter_overrides && counter.counter_overrides[overrideKey]) {
      counterReading = counter.counter_overrides[overrideKey];
    }

    return {
      id:      'count_' + nInt + '_' + counterKey,
      surface: num.surface + counter.surface,
      reading: numReading + counterReading,
      meaning: nInt + ' ' + counter.meaning
    };
  }

  window.JPShared.counterEngine = {
    buildCounterTerm: buildCounterTerm
  };

})();
