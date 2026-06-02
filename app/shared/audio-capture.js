/**
 * app/shared/audio-capture.js
 * Microphone recorder for Ask Rikizo's voice questions. Records a short clip via
 * getUserMedia + MediaRecorder, returns it base64-encoded; the server transcribes
 * it (Google STT) and answers. This path works in desktop browsers AND the iOS
 * Capacitor WKWebView (which, unlike Web Speech, does support MediaRecorder when
 * the app has the microphone permission — see ios Info.plist NSMicrophoneUsageDescription).
 *
 * Self-registers on window.JPShared.audioCapture.
 *
 * API:
 *   isAvailable() -> boolean
 *   start({ onError })  -> Promise<boolean>   begin recording (prompts mic perm)
 *   stop()              -> Promise<{ base64, format, seconds } | null>  finalize
 *   cancel()            -> void                discard
 *   isRecording() -> boolean
 *
 * Format: whatever MediaRecorder yields for this engine — webm/opus (Chrome) or
 * mp4/aac (Safari/iOS). We report a short `format` tag the server maps to a GCP
 * encoding. The 15s cap is enforced here as a hard backstop (server caps too).
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};
  if (window.JPShared.audioCapture) return;

  var MAX_SECONDS = 15;

  var stream = null;
  var recorder = null;
  var chunks = [];
  var startedAt = 0;
  var recording = false;
  var autoStopTimer = null;

  function hasGUM() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
              typeof window.MediaRecorder !== 'undefined');
  }
  function isAvailable() { return hasGUM(); }
  function isRecording() { return recording; }

  // Pick a mime type this engine actually supports; '' lets the browser default.
  function pickMime() {
    var prefs = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/ogg;codecs=opus'];
    if (!window.MediaRecorder || !MediaRecorder.isTypeSupported) return '';
    for (var i = 0; i < prefs.length; i++) {
      if (MediaRecorder.isTypeSupported(prefs[i])) return prefs[i];
    }
    return '';
  }

  // Map a mime type to the short format tag server/lib/stt.js understands.
  function formatTag(mime) {
    mime = mime || '';
    if (mime.indexOf('webm') !== -1) return 'webm';
    if (mime.indexOf('ogg') !== -1) return 'opus';
    if (mime.indexOf('mp4') !== -1 || mime.indexOf('aac') !== -1 || mime.indexOf('m4a') !== -1) return 'm4a';
    return 'webm';
  }

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var fr = new FileReader();
      fr.onloadend = function () {
        // result is a data URL "data:audio/...;base64,XXXX" — keep only the payload.
        var s = String(fr.result || '');
        var comma = s.indexOf(',');
        resolve(comma >= 0 ? s.slice(comma + 1) : '');
      };
      fr.onerror = function () { reject(new Error('read_failed')); };
      fr.readAsDataURL(blob);
    });
  }

  function teardownStream() {
    if (stream) {
      try { stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      stream = null;
    }
  }

  function start(opts) {
    opts = opts || {};
    if (!hasGUM() || recording) return Promise.resolve(false);
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      stream = s;
      chunks = [];
      var mime = pickMime();
      try {
        recorder = mime ? new MediaRecorder(s, { mimeType: mime }) : new MediaRecorder(s);
      } catch (e) {
        recorder = new MediaRecorder(s);
      }
      recorder.ondataavailable = function (ev) { if (ev.data && ev.data.size) chunks.push(ev.data); };
      recorder.start();
      recording = true;
      startedAt = Date.now();
      // Hard cap: auto-stop at MAX_SECONDS so a stuck press can't run away.
      autoStopTimer = setTimeout(function () { if (recording) stop(); }, MAX_SECONDS * 1000);
      return true;
    }, function (err) {
      teardownStream();
      var name = (err && err.name) || 'error';
      if (opts.onError) opts.onError(name === 'NotAllowedError' ? 'not-allowed' : 'mic-failed');
      return false;
    });
  }

  /** Stop and resolve with the recorded clip, or null if nothing usable. */
  function stop() {
    if (!recorder || !recording) return Promise.resolve(null);
    if (autoStopTimer) { clearTimeout(autoStopTimer); autoStopTimer = null; }
    var seconds = Math.max(0, (Date.now() - startedAt) / 1000);
    var mime = recorder.mimeType || pickMime();
    return new Promise(function (resolve) {
      recorder.onstop = function () {
        recording = false;
        teardownStream();
        if (!chunks.length) { resolve(null); return; }
        var blob = new Blob(chunks, { type: mime || 'audio/webm' });
        chunks = [];
        blobToBase64(blob).then(function (b64) {
          resolve(b64 ? { base64: b64, format: formatTag(mime), seconds: Math.round(seconds * 10) / 10 } : null);
        }, function () { resolve(null); });
      };
      try { recorder.stop(); } catch (e) { recording = false; teardownStream(); resolve(null); }
    });
  }

  function cancel() {
    if (autoStopTimer) { clearTimeout(autoStopTimer); autoStopTimer = null; }
    if (recorder && recording) {
      recorder.onstop = null;
      try { recorder.stop(); } catch (e) {}
    }
    recording = false;
    chunks = [];
    teardownStream();
  }

  window.JPShared.audioCapture = {
    isAvailable: isAvailable,
    isRecording: isRecording,
    start: start,
    stop: stop,
    cancel: cancel,
    MAX_SECONDS: MAX_SECONDS
  };
})();
