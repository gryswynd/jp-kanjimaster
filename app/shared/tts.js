/**
 * app/shared/tts.js
 * Japanese audio playback — pre-generated Chirp 3 HD clips.
 *
 * This module REPLACED the old Web Speech API engine. There is no device
 * speech synthesis and no runtime fallback ("all-in on Chirp"): every spoken
 * string is a clip baked at build time by scripts/generate-audio.mjs and
 * addressed through data/audio/manifest.audio.json. A miss (e.g. Compose's
 * free text, or content not yet generated) is a silent no-op — the finish
 * callbacks still fire so play/stop UI toggles always reset.
 *
 * Public API is unchanged from the Web Speech version so every callsite
 * (Lesson.js, Review.js, Stories.js, Grammar.js, Compose.js) and tts-settings.js
 * keep working:
 *   speak(text, {terms, termMap, rate, voice})  speakLines(lines, {termMap, onFinish})
 *   cancel()  isSpeaking()
 *   getVoices()  getSelectedVoice()  setVoice(uri)  getRate()  setRate(r)
 *   preprocess(text, pairs)  buildReadings(terms, termMap)  isSupported()
 *   setConfig(config)   ← NEW: lets us resolve clip URLs (call from app boot)
 *
 * The text→clip key is computed by window.JPShared.ttsNormalize.normalizeKey,
 * the SAME function the build generator uses — so keys match byte-for-byte.
 * Load tts-normalize.js BEFORE this file.
 */
(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  var PREFS_KEY = 'jp-tts-prefs';
  var MANIFEST_PATH = 'data/audio/manifest.audio.json';

  // Curated Chirp 3 HD voices. This is the NARRATOR picker — everything except a
  // conversation line is spoken by the narrator, and only Fenrir is baked for it.
  // Conversation lines pass their speaker's voice into speak()/speakLines()
  // instead; those clips live in manifest.voices (see clipFor).
  var VOICES = [
    { uri: 'Fenrir', name: 'Fenrir', label: 'Fenrir', gender: 'male', locale: 'ja-JP' }
  ];
  var NARRATOR = 'Fenrir';

  // --- State ---
  var repoConfig = null;
  var manifest = null;          // { basePath, clips: {key:{file,dur}}, voices: {voice:{key:{file,dur}}} }
  var manifestPromise = null;
  var selectedVoiceURI = VOICES[0].uri;
  var selectedRate = 0.9;
  var cancelToken = 0;          // bumped on cancel/new playback; guards async callbacks
  var audioEl = null;           // single reused element (keeps iOS gesture chain alive)
  var onFinishCallback = null;  // single-shot, for speakLines/cancel
  var playing = false;

  var norm = function () { return window.JPShared.ttsNormalize; };

  // --- Preferences ---
  function loadPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        var prefs = JSON.parse(raw);
        if (prefs.voiceURI && VOICES.some(function (v) { return v.uri === prefs.voiceURI; })) {
          selectedVoiceURI = prefs.voiceURI;
        }
        if (prefs.rate !== undefined) selectedRate = prefs.rate;
      }
    } catch (e) { /* ignore */ }
  }
  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ voiceURI: selectedVoiceURI, rate: selectedRate }));
    } catch (e) { /* ignore */ }
  }
  loadPrefs();

  // --- Asset URL resolution (mirrors stamp-settings.js) ---
  function resolve(relativePath) {
    if (repoConfig && window.getAssetUrl) return window.getAssetUrl(repoConfig, relativePath);
    return relativePath;
  }

  // --- Manifest ---
  function ensureManifest() {
    if (manifestPromise) return manifestPromise;
    var url = resolve(MANIFEST_PATH) + '?t=' + Date.now();
    manifestPromise = fetch(url)
      .then(function (r) { return r.json(); })
      .then(function (m) {
        manifest = m && m.clips ? m : { basePath: 'data/audio/clips', clips: {} };
        if (!manifest.basePath) manifest.basePath = 'data/audio/clips';
        return manifest;
      })
      .catch(function () {
        manifest = { basePath: 'data/audio/clips', clips: {} };
        return manifest;
      });
    return manifestPromise;
  }

  function clipFor(text, termPairs, reading, voice) {
    if (!manifest) return null;
    var nz = norm();
    if (!nz) return null;
    // Isolated readings (kun/on chips) use readingKey (katakana for は/へ/を) so
    // Chirp doesn't misread them as particles; sentences use normalizeKey.
    var key = reading ? nz.readingKey(text) : nz.normalizeKey(text, termPairs);

    // A conversation line resolves against its speaker's voice; everything else
    // (and any voiced clip that somehow wasn't baked) falls back to the narrator,
    // so a gap degrades to the wrong voice rather than to silence. Only
    // scripts/validate-audio.mjs can catch that gap — keep it strict.
    var rec = null;
    if (voice && voice !== NARRATOR && manifest.voices && manifest.voices[voice]) {
      rec = manifest.voices[voice][key];
    }
    if (!rec) rec = manifest.clips[key];
    if (!rec) return null;
    // Server-delivered clips (addClips) carry an absolute url; bundled clips
    // resolve against the local manifest basePath.
    if (rec.url) return { url: rec.url, dur: rec.dur, key: key };
    return { url: resolve(manifest.basePath + '/' + rec.file), dur: rec.dur, key: key };
  }

  // --- Audio element ---
  function getAudioEl() {
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.preload = 'auto';
    }
    return audioEl;
  }

  function clamp(r) { return Math.max(0.5, Math.min(1.5, r)); }

  // Play one clip on the shared element. onDone fires on end, error, or miss.
  // token guards against a cancel()/new playback landing mid-flight.
  function playOne(text, termPairs, rate, token, onDone, reading, voice) {
    var done = false;
    function finishLocal() {
      if (done) return;
      done = true;
      if (token === cancelToken && onDone) onDone();
    }

    var clip = clipFor(text, termPairs, reading, voice);
    if (!clip) {
      if (typeof console !== 'undefined' && console.debug) {
        console.debug('[tts] no clip for key:', (norm() && (reading ? norm().readingKey(text) : norm().normalizeKey(text, termPairs))) || text);
      }
      // Resolve on the next tick so callers that chain don't recurse synchronously.
      setTimeout(finishLocal, 0);
      return;
    }

    var a = getAudioEl();
    a.onended = finishLocal;
    a.onerror = finishLocal;
    try {
      a.src = clip.url;
      a.playbackRate = clamp(rate !== undefined ? rate : selectedRate);
      a.currentTime = 0;
      playing = true;
      var p = a.play();
      if (p && p.catch) p.catch(function () { finishLocal(); });
    } catch (e) {
      finishLocal();
    }
  }

  function fireFinish() {
    var cb = onFinishCallback;
    onFinishCallback = null;
    if (cb) cb();
  }

  function stopAudio() {
    playing = false;
    if (audioEl) {
      try { audioEl.pause(); } catch (e) {}
      audioEl.onended = null;
      audioEl.onerror = null;
      try { audioEl.removeAttribute('src'); audioEl.load(); } catch (e) {}
    }
  }

  // --- Public API ---
  window.JPShared.tts = {

    /**
     * Store the repo config so clip URLs resolve, and eagerly load the manifest
     * so the first tap plays inside the user gesture. Call from app boot.
     */
    setConfig: function (config) {
      repoConfig = config;
      ensureManifest();
    },

    /**
     * Merge a per-story clip map (server-generated custom stories) into the
     * in-memory manifest. Each entry is keyed by the SAME normalizeKey the
     * build generator uses, so playback resolves with no other change. Clips
     * live at an absolute basePath (the GCS bucket), stored as rec.url so they
     * bypass the local-asset resolver. Additive + idempotent; safe to call on
     * every story load. Missing keys remain a silent no-op as before.
     * @param {Object} clipMap { normalizeKey: { file, dur } | "file" }
     * @param {string} [basePath] absolute URL prefix for relative files
     */
    addClips: function (clipMap, basePath) {
      if (!clipMap || typeof clipMap !== 'object') return;
      var base = basePath ? String(basePath).replace(/\/+$/, '') : '';
      var apply = function () {
        Object.keys(clipMap).forEach(function (key) {
          var rec = clipMap[key];
          if (!rec) return;
          var file = (typeof rec === 'string') ? rec : rec.file;
          if (!file) return;
          var url = /^https?:\/\//.test(file) ? file : (base ? base + '/' + file : file);
          manifest.clips[key] = { file: file, dur: (rec && rec.dur) || 0, url: url };
        });
      };
      if (manifest) apply(); else ensureManifest().then(apply);
    },

    /**
     * Speak a single Japanese string (one pre-baked clip).
     * @param {string} text
     * @param {Object} [options] {rate, terms, termMap, reading, voice}
     *   options.reading=true → isolated kun/on reading (katakana-keyed).
     *   options.voice → a conversation speaker's Chirp voice
     *                   (JPShared.characters.voiceFor); omit for the narrator.
     */
    speak: function (text, options) {
      this.cancel();
      if (!text || !text.trim()) return;
      var opts = options || {};
      var token = ++cancelToken;
      var nz = norm();
      var isReading = !!opts.reading;
      // terms→kana layer dropped: sentences synthesize as kanji (better Chirp
      // prosody); ambiguous readings handled by the static override table.
      var termPairs = null;

      var go = function () {
        if (token !== cancelToken) return;
        playOne(text.trim(), termPairs, opts.rate, token, function () {
          if (token === cancelToken) playing = false;
        }, isReading, opts.voice);
      };
      if (manifest) go(); else ensureManifest().then(go);
    },

    /**
     * Speak multiple lines sequentially (conversations / play-all).
     * Lines may be plain strings or {jp, terms, voice} objects; a line's `voice`
     * makes it play in that character's voice, so a conversation reads back as a
     * real exchange rather than one narrator doing both halves.
     * @param {string[]|{jp:string,terms:Array,voice:string}[]} lines
     * @param {Object} [options] {termMap, onFinish}
     */
    speakLines: function (lines, options) {
      this.cancel();
      if (!lines || !lines.length) return;
      var opts = options || {};
      if (opts.onFinish) onFinishCallback = opts.onFinish;

      var queue = [];
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        var jp, voice;
        if (typeof line === 'string') jp = line;
        else if (line && line.jp) { jp = line.jp; voice = line.voice; }  // terms ignored — kanji synthesis
        else continue;
        if (!jp || !jp.trim()) continue;
        queue.push({ jp: jp.trim(), pairs: null, voice: voice });
      }
      if (!queue.length) { fireFinish(); return; }

      var token = ++cancelToken;
      playing = true;

      function next() {
        if (token !== cancelToken) return;          // cancelled / superseded
        if (!queue.length) { playing = false; fireFinish(); return; }
        var item = queue.shift();
        playOne(item.jp, item.pairs, undefined, token, function () {
          if (token !== cancelToken) return;
          setTimeout(next, 120);                    // small inter-line gap
        }, false, item.voice);
      }

      if (manifest) next(); else ensureManifest().then(next);
    },

    /** Cancel current playback / queue. Fires any pending onFinish. */
    cancel: function () {
      cancelToken++;
      stopAudio();
      fireFinish();
    },

    /** @returns {boolean} whether a clip is currently playing. */
    isSpeaking: function () {
      return !!(playing && audioEl && !audioEl.paused && !audioEl.ended);
    },

    // --- Voice management (fixed curated list) ---
    getVoices: function () { return VOICES.slice(); },
    getSelectedVoice: function () {
      var found = VOICES.filter(function (v) { return v.uri === selectedVoiceURI; })[0];
      return found || VOICES[0];
    },
    setVoice: function (voiceURI) {
      if (VOICES.some(function (v) { return v.uri === voiceURI; })) {
        selectedVoiceURI = voiceURI;
        savePrefs();
      }
    },

    // --- Rate ---
    getRate: function () { return selectedRate; },
    setRate: function (rate) {
      selectedRate = clamp(rate);
      savePrefs();
      if (audioEl) audioEl.playbackRate = selectedRate;
    },

    isSupported: function () { return true; },

    // --- Normalization passthroughs (kept for any debug/legacy callers) ---
    preprocess: function (text, termPairs) {
      var nz = norm();
      return nz ? nz.preprocess(text, termPairs) : text;
    },
    buildReadings: function (terms, termMap) {
      var nz = norm();
      return nz ? nz.buildReadingsFromTerms(terms, termMap) : [];
    }
  };

})();
