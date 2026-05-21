/**
 * app/shared/tts.js
 * Shared text-to-speech helper for Japanese audio playback.
 *
 * Features:
 *   - Voice discovery and selection (filtered to ja-JP)
 *   - User-configurable speed (rate) and voice preference
 *   - Sequential chunking for long text (passages, conversations)
 *   - localStorage persistence of voice/speed preferences
 *   - Mobile-optimized with retry logic and timeout protection
 *   - Pronunciation preprocessing for common TTS edge cases
 *   - onFinish callback for play/stop button integration
 *   - Reading resolver: fixes kanji-compound mispronunciations via a two-tier
 *     system — (1) terms-aware pass using glossary reading fields when terms
 *     context is available, (2) static override map for 50+ commonly misread
 *     compounds (何時→なんじ, 今日→きょう, etc.) applied unconditionally
 *
 * Load this file before any feature module scripts.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  // --- localStorage key ---
  var PREFS_KEY = 'jp-tts-prefs';

  // --- Internal state ---
  var cachedVoices = [];
  var selectedVoiceURI = null;
  var selectedRate = 0.9;
  var chunkQueue = [];
  var isChunking = false;
  var onFinishCallback = null;
  var cancelToken = 0;  // incremented on cancel; speakOne checks before speaking

  // --- Load saved preferences ---
  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        var prefs = JSON.parse(raw);
        if (prefs.voiceURI) selectedVoiceURI = prefs.voiceURI;
        if (prefs.rate !== undefined) selectedRate = prefs.rate;
      }
    } catch (e) {
      console.warn('TTS: Could not load preferences', e);
    }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({
        voiceURI: selectedVoiceURI,
        rate: selectedRate
      }));
    } catch (e) {
      console.warn('TTS: Could not save preferences', e);
    }
  }

  // --- Voice discovery ---
  function refreshVoices() {
    if (!window.speechSynthesis) return;
    var allVoices = window.speechSynthesis.getVoices();
    cachedVoices = allVoices.filter(function (v) {
      return v.lang && v.lang.replace('_', '-').indexOf('ja') === 0;
    });
    // Sort: prioritise voices with "Google" or "Enhanced" or "Premium" in name
    cachedVoices.sort(function (a, b) {
      var aQ = /google|enhanced|premium|compact/i.test(a.name) ? 0 : 1;
      var bQ = /google|enhanced|premium|compact/i.test(b.name) ? 0 : 1;
      if (aQ !== bQ) return aQ - bQ;
      // Then local voices before remote
      if (a.localService !== b.localService) return a.localService ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  function findVoice() {
    if (cachedVoices.length === 0) refreshVoices();
    // Try user's saved preference first
    if (selectedVoiceURI) {
      for (var i = 0; i < cachedVoices.length; i++) {
        if (cachedVoices[i].voiceURI === selectedVoiceURI) return cachedVoices[i];
      }
    }
    // Fall back to first available Japanese voice
    return cachedVoices.length > 0 ? cachedVoices[0] : null;
  }

  // Listen for voiceschanged (Chrome loads voices asynchronously)
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = function () {
      refreshVoices();
    };
    // Eager load on init
    refreshVoices();
  }

  // Load saved preferences on init
  loadPrefs();

  // --- Pronunciation preprocessing ---
  // Fixes common TTS mispronunciations by rewriting text before speaking.

  // Partial-kanji day names that TTS engines often botch
  var readingFixes = [
    // Day-of-week partial kanji → full hiragana readings
    [/金よう日/g, 'きんようび'],
    [/月よう日/g, 'げつようび'],
    [/火よう日/g, 'かようび'],
    [/水よう日/g, 'すいようび'],
    [/木よう日/g, 'もくようび'],
    [/土よう日/g, 'どようび'],
    [/日よう日/g, 'にちようび'],
    [/何よう日/g, 'なんようび'],
    // Partial-kanji compounds where TTS misreads the mix
    [/大すき/g, 'だいすき'],
    [/朝ごはん/g, 'あさごはん'],
    [/晩ごはん/g, 'ばんごはん'],
    [/名まえ/g, 'なまえ']
  ];

  // --- Static reading overrides ---
  // Kanji compounds whose correct reading TTS engines frequently get wrong.
  // Applied before the は-particle fix. Entries are sorted longest-first so
  // that longer compounds (e.g. 二十日) are replaced before their substrings
  // (e.g. 十日, 日) can be touched.
  //
  // Key rule: only include words where the TTS default reading is wrong for
  // JLPT lesson content. Do NOT add entries that TTS already reads correctly.
  var staticOverrides = [
    // --- Time questions (most critical: 何時 is read as いつ "when" by default) ---
    ['何時間', 'なんじかん'],   // how many hours  — longer compound first
    ['何時ごろ', 'なんじごろ'], // what time (around)
    ['何時', 'なんじ'],         // what time  ← the confirmed bug trigger
    ['何分', 'なんぷん'],       // what minute / how many minutes
    ['何日', 'なんにち'],       // what day / how many days
    ['何人', 'なんにん'],       // how many people
    ['何回', 'なんかい'],       // how many times
    ['何本', 'なんぼん'],       // how many (long objects)
    ['何枚', 'なんまい'],       // how many (flat objects)
    ['何冊', 'なんさつ'],       // how many (books)
    ['何匹', 'なんびき'],       // how many (small animals)
    ['何杯', 'なんばい'],       // how many cups/glasses
    ['何台', 'なんだい'],       // how many (machines/vehicles)
    ['何歳', 'なんさい'],       // how old
    // --- Calendar dates: ordinal date readings that TTS often mispronounces ---
    ['二十日', 'はつか'],       // 20th / 20 days
    ['十四日', 'じゅうよっか'], // 14th
    ['二十四日', 'にじゅうよっか'], // 24th
    ['十日', 'とおか'],         // 10th / 10 days
    ['三日', 'みっか'],         // 3rd / 3 days
    ['四日', 'よっか'],         // 4th / 4 days
    ['八日', 'ようか'],         // 8th / 8 days
    ['九日', 'ここのか'],       // 9th / 9 days
    ['七日', 'なのか'],         // 7th / 7 days  (vs しちにち)
    ['六日', 'むいか'],         // 6th / 6 days
    ['五日', 'いつか'],         // 5th / 5 days
    ['二日', 'ふつか'],         // 2nd / 2 days
    ['一日', 'いちにち'],       // one day       (ついたち for 1st of month is rare in lessons)
    // --- Time/calendar words with notoriously wrong TTS defaults ---
    ['今日', 'きょう'],         // today    (TTS may say こんにち)
    ['明日', 'あした'],         // tomorrow (TTS may say あす or みょうにち)
    ['昨日', 'きのう'],         // yesterday (TTS may say さくじつ)
    ['今朝', 'けさ'],           // this morning
    ['今年', 'ことし'],         // this year (TTS may say こんねん)
    ['去年', 'きょねん'],       // last year (TTS may say こぞ)
    ['今夜', 'こんや'],         // tonight
    ['今晩', 'こんばん'],       // this evening
    // --- Counting people ---
    ['二人', 'ふたり'],         // two people (vs ににん)
    ['一人', 'ひとり'],         // one person (vs いちにん)
    // --- Skill/ability nouns ---
    ['上手', 'じょうず'],       // good at (vs うわて)
    ['下手', 'へた'],           // bad at  (vs したて)
    // --- Common nouns ---
    ['大人', 'おとな'],         // adult (vs だいじん)
    ['今週', 'こんしゅう'],     // this week
    ['先週', 'せんしゅう'],     // last week
    ['来週', 'らいしゅう'],     // next week
    ['先月', 'せんげつ'],       // last month
    ['来月', 'らいげつ'],       // next month
    ['来年', 'らいねん'],       // next year
    ['毎日', 'まいにち'],       // every day
    ['毎週', 'まいしゅう'],     // every week
    ['毎月', 'まいつき'],       // every month  (vs まいげつ)
    ['毎年', 'まいとし'],       // every year   (vs まいねん)
    ['毎朝', 'まいあさ'],       // every morning
    ['毎晩', 'まいばん'],       // every evening
    ['今月', 'こんげつ']        // this month
  ];

  // Build sorted-longest-first replacement pairs once at module load.
  // We use literal string matching (not regex) for the override map so that
  // special-regex characters in surface forms are never a problem.
  var _overridePairs = (function () {
    var pairs = staticOverrides.slice();
    pairs.sort(function (a, b) { return b[0].length - a[0].length; });
    return pairs;
  }());

  /**
   * Apply static override map to text.
   * Scans left-to-right, replacing the longest matching surface first.
   * Characters already replaced are not re-examined.
   */
  function applyStaticOverrides(text) {
    // Simple left-to-right scan with longest-match.
    // Build a result array of characters/substitutions.
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

  /**
   * Build a surface→reading map from a terms array + termMap.
   * Only entries that have both surface and reading fields are included.
   * Longer surfaces are placed first so applyReadingsMap does longest-match.
   *
   * @param {Array} terms   - Line's terms array (strings or {id,form} objects)
   * @param {Object} termMap - The app's shared termMap (id → term entry)
   * @returns {Array} Array of [surface, reading] pairs sorted longest-first
   */
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
      // Only override if surface contains kanji (kana-only entries read fine)
      if (!/[\u4E00-\u9FFF]/.test(entry.surface)) continue;
      // Don't add if surface === reading (already kana)
      if (entry.surface === entry.reading) continue;
      pairs.push([entry.surface, entry.reading]);
    }
    pairs.sort(function (a, b) { return b[0].length - a[0].length; });
    return pairs;
  }

  /**
   * Apply a surface→reading pairs array to text, longest-match-first.
   * Same algorithm as applyStaticOverrides but takes a dynamic pairs array.
   *
   * @param {string} text
   * @param {Array}  pairs - [[surface, reading], ...] sorted longest-first
   * @returns {string}
   */
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

  // Words where は is NOT a particle (must not be converted to わ)
  // Includes common words starting with は and words containing は mid-word
  var haWordPatterns = /^(は[いじめなしか]|はし|はこ|はたらく|はたち|はる|はれ|はん|はなし|はなす|はや|はず|はっきり|はんぶん)|こんにちは$|こんばんは$|では|には|ごはん|おはよう/;

  /**
   * Preprocess text for TTS. Applies fixes in this order:
   *   1. Per-line terms-aware readings (most precise — uses glossary reading field)
   *   2. Static reading overrides (kanji compounds with wrong TTS defaults)
   *   3. Partial-kanji readingFixes (day-of-week, etc.)
   *   4. は particle pronunciation correction
   *
   * @param {string} text
   * @param {Array}  [termPairs] - Optional [[surface, reading], ...] from buildReadingsFromTerms()
   * @returns {string}
   */
  function preprocessForTTS(text, termPairs) {
    if (!text) return text;

    // 1. Terms-aware substitution (highest priority — comes from lesson data)
    if (termPairs && termPairs.length > 0) {
      text = applyReadingsMap(text, termPairs);
    }

    // 2. Static overrides for commonly mispronounced kanji compounds
    text = applyStaticOverrides(text);

    // 3. Apply known reading fixes for partial-kanji words
    for (var i = 0; i < readingFixes.length; i++) {
      text = text.replace(readingFixes[i][0], readingFixes[i][1]);
    }

    // 4. Fix は particle pronunciation: replace は with わ when it's a particle
    // Strategy: split on は, check context to decide particle vs word-internal
    text = text.replace(/([\u4E00-\u9FFF\u30A0-\u30FF\u3040-\u309Fー])は(?=[\u4E00-\u9FFF\u30A0-\u30FF\u3040-\u309Fー、。！？\s]|$)/g,
      function(match, preceding) {
        return preceding + 'わ';
      }
    );

    // Restore は in greetings and fixed expressions where は = "ha"
    text = text.replace(/こんにちわ/g, 'こんにちは');
    text = text.replace(/こんばんわ/g, 'こんばんは');

    return text;
  }

  // --- Core speak function ---
  function speakOne(text, options, onDone) {
    var opts = options || {};
    var lang   = opts.lang   || 'ja-JP';
    var rate   = (opts.rate   !== undefined) ? opts.rate   : selectedRate;
    var volume = (opts.volume !== undefined) ? opts.volume : 1.0;

    if (!window.speechSynthesis) {
      console.warn('Speech synthesis not supported');
      if (onDone) onDone();
      return;
    }

    // Preprocess for pronunciation (opts.termPairs carries terms-aware readings)
    var processed = preprocessForTTS(text, opts.termPairs);
    var token = cancelToken;

    try {
      window.speechSynthesis.cancel();

      setTimeout(function () {
        // Bail out if cancel() was called during the delay
        if (token !== cancelToken) { if (onDone) onDone(); return; }

        var utterance = new SpeechSynthesisUtterance(processed);
        utterance.lang   = lang;
        utterance.rate   = rate;
        utterance.volume = volume;

        // Apply selected voice
        var voice = findVoice();
        if (voice) utterance.voice = voice;

        // Error handling with retry logic
        utterance.onerror = function (event) {
          console.error('Speech synthesis error:', event.error);
          if ((event.error === 'not-allowed' || event.error === 'interrupted') && !utterance._retried) {
            utterance._retried = true;
            setTimeout(function () {
              window.speechSynthesis.cancel();
              window.speechSynthesis.speak(utterance);
            }, 100);
          } else {
            if (onDone) onDone();
          }
        };

        // iOS Safari fix: resume if paused
        utterance.onstart = function () {
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        };

        // Timeout protection: cancel if still speaking after 15 seconds
        var timeoutId = setTimeout(function () {
          window.speechSynthesis.cancel();
          if (onDone) onDone();
        }, 15000);

        utterance.onend = function () {
          clearTimeout(timeoutId);
          if (onDone) onDone();
        };

        window.speechSynthesis.speak(utterance);
      }, 50);
    } catch (error) {
      console.error('TTS Error:', error);
      if (onDone) onDone();
    }
  }

  // --- Chunking for long text ---
  // Splits on Japanese sentence boundaries and plays sequentially
  function splitIntoChunks(text) {
    // Split on 。！？ and keep the delimiter attached
    var parts = text.split(/(。|！|？|！|\!|\?)/);
    var chunks = [];
    for (var i = 0; i < parts.length; i += 2) {
      var sentence = parts[i];
      var delim = (i + 1 < parts.length) ? parts[i + 1] : '';
      var chunk = (sentence + delim).trim();
      if (chunk) chunks.push(chunk);
    }
    return chunks;
  }

  function fireFinish() {
    var cb = onFinishCallback;
    onFinishCallback = null;
    if (cb) cb();
  }

  function playChunkQueue(options) {
    if (chunkQueue.length === 0) {
      isChunking = false;
      fireFinish();
      return;
    }
    var token = cancelToken;
    var chunk = chunkQueue.shift();

    // chunk is either a plain string or a {text, termPairs} object
    var chunkText, chunkOpts;
    if (typeof chunk === 'string') {
      chunkText = chunk;
      chunkOpts = options;
    } else {
      chunkText = chunk.text;
      chunkOpts = chunk.termPairs
        ? Object.assign({}, options, { termPairs: chunk.termPairs })
        : options;
    }

    speakOne(chunkText, chunkOpts, function () {
      // Bail out if cancelled during playback
      if (token !== cancelToken) return;
      // Small pause between sentences for natural rhythm
      setTimeout(function () {
        if (token !== cancelToken) return;
        playChunkQueue(options);
      }, 200);
    });
  }

  // --- Public API ---
  window.JPShared.tts = {

    /**
     * Speak a Japanese string. For short text (single words/sentences),
     * plays directly. For long text, automatically chunks on sentence boundaries.
     *
     * Pronunciation resolution order (highest → lowest priority):
     *   1. options.terms + options.termMap → reading field from the app's glossary
     *   2. Built-in static overrides for commonly mispronounced kanji compounds
     *   3. Partial-kanji readingFixes (day names, etc.)
     *   4. は particle correction
     *
     * @param {string} text
     * @param {Object} [options]
     * @param {string} [options.lang='ja-JP']
     * @param {number} [options.rate]     - Overrides user preference if set
     * @param {number} [options.volume=1.0]
     * @param {Array}  [options.terms]    - Line's terms array (ids or {id,form} objects)
     * @param {Object} [options.termMap]  - App's shared termMap (id → glossary entry)
     */
    speak: function (text, options) {
      // Cancel any ongoing speech/chunking
      this.cancel();

      if (!text || !text.trim()) return;

      var opts = options || {};
      var trimmed = text.trim();

      // Build terms-aware reading pairs if caller provided terms context
      var termPairs = (opts.terms && opts.termMap)
        ? buildReadingsFromTerms(opts.terms, opts.termMap)
        : null;
      var speakOpts = termPairs ? Object.assign({}, opts, { termPairs: termPairs }) : opts;

      // If text is short enough, speak directly
      if (trimmed.length <= 200) {
        speakOne(trimmed, speakOpts);
      } else {
        // Chunk and play sequentially
        chunkQueue = splitIntoChunks(trimmed);
        isChunking = true;
        playChunkQueue(speakOpts);
      }
    },

    /**
     * Speak multiple lines sequentially (for conversations).
     * Each line is spoken one after another with a pause between.
     *
     * Supports two input formats:
     *   - Simple: string[] — each element is plain Japanese text
     *   - Rich:   {jp, terms}[] — each element carries jp text + its terms array
     *
     * When the rich format is used and options.termMap is provided, each line's
     * terms array is resolved against the glossary for accurate pronunciation.
     *
     * @param {string[]|{jp:string, terms:Array}[]} lines
     * @param {Object} [options]
     * @param {Function} [options.onFinish]  - Called when all lines finish or stopped
     * @param {Object}   [options.termMap]   - App's shared termMap for rich format
     */
    speakLines: function (lines, options) {
      this.cancel();

      if (!lines || lines.length === 0) return;

      var opts = options || {};
      if (opts.onFinish) {
        onFinishCallback = opts.onFinish;
      }

      var hasTermMap = !!(opts.termMap);

      // Normalize to [{text, termPairs}] entries for the chunk queue
      chunkQueue = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var jp, termPairs;
        if (typeof line === 'string') {
          jp = line;
          termPairs = null;
        } else if (line && line.jp) {
          jp = line.jp;
          termPairs = (hasTermMap && line.terms)
            ? buildReadingsFromTerms(line.terms, opts.termMap)
            : null;
        } else {
          continue;
        }
        if (!jp || !jp.trim()) continue;
        chunkQueue.push(termPairs ? { text: jp, termPairs: termPairs } : jp);
      }

      isChunking = true;
      playChunkQueue(opts);
    },

    /**
     * Cancel any currently playing utterance or queued chunks.
     */
    cancel: function () {
      cancelToken++;
      chunkQueue = [];
      isChunking = false;
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      fireFinish();
    },

    /**
     * Return whether TTS is currently playing (including chunk queue).
     * @returns {boolean}
     */
    isSpeaking: function () {
      return isChunking || (window.speechSynthesis && window.speechSynthesis.speaking);
    },

    // --- Voice management ---

    /**
     * Get all available Japanese voices.
     * @returns {SpeechSynthesisVoice[]}
     */
    getVoices: function () {
      refreshVoices();
      return cachedVoices.slice();
    },

    /**
     * Get the currently selected voice (or null).
     * @returns {SpeechSynthesisVoice|null}
     */
    getSelectedVoice: function () {
      return findVoice();
    },

    /**
     * Set voice by voiceURI string. Persists to localStorage.
     * @param {string} voiceURI
     */
    setVoice: function (voiceURI) {
      selectedVoiceURI = voiceURI;
      savePrefs();
    },

    /**
     * Get the current speech rate.
     * @returns {number}
     */
    getRate: function () {
      return selectedRate;
    },

    /**
     * Set speech rate (0.5–2.0). Persists to localStorage.
     * @param {number} rate
     */
    setRate: function (rate) {
      selectedRate = Math.max(0.5, Math.min(2.0, rate));
      savePrefs();
    },

    /**
     * Check if speech synthesis is supported.
     * @returns {boolean}
     */
    isSupported: function () {
      return !!window.speechSynthesis;
    },

    /**
     * Preprocess text for TTS (exposed for testing/debugging).
     * @param {string} text
     * @param {Array}  [termPairs] - Optional [[surface, reading], ...] pairs
     * @returns {string}
     */
    preprocess: preprocessForTTS,

    /**
     * Build a surface→reading pairs array from a terms array + termMap.
     * Exposed so callers can pre-compute pairs once and reuse them.
     *
     * @param {Array}  terms   - Line's terms array (strings or {id,form} objects)
     * @param {Object} termMap - The app's shared termMap (id → glossary entry)
     * @returns {Array} [[surface, reading], ...] sorted longest-first
     */
    buildReadings: buildReadingsFromTerms

  };

})();
