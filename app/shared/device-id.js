/**
 * app/shared/device-id.js
 * Anonymous, persistent device identifier for the Rikizo tutor backend.
 *
 * localStorage keys:
 *   k-device-id — string  UUID v4, generated once per install
 *
 * The id is sent as the X-Device-Id header on every tutor request and is the
 * tutor's only notion of identity in V1 (no accounts). The server pairs it with
 * an iOS App Attest identity to resist quota farming — see the tutor plan.
 *
 * Self-registers on window.JPShared.deviceId.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  var KEY = 'k-device-id';

  /** RFC-4122 v4 UUID, preferring the platform generator when present. */
  function uuid() {
    try {
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
      }
    } catch (e) { /* fall through to manual generation */ }

    var bytes = null;
    try {
      bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
    } catch (e2) { bytes = null; }

    var b = [];
    for (var i = 0; i < 16; i++) {
      b.push(bytes ? bytes[i] : Math.floor(Math.random() * 256));
    }
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10

    var h = [];
    for (var j = 0; j < 16; j++) h.push((b[j] + 0x100).toString(16).substr(1));
    return h[0] + h[1] + h[2] + h[3] + '-' + h[4] + h[5] + '-' + h[6] + h[7] +
           '-' + h[8] + h[9] + '-' + h[10] + h[11] + h[12] + h[13] + h[14] + h[15];
  }

  /** Return the persistent device id, generating + storing one on first call. */
  function get() {
    var id = null;
    try { id = localStorage.getItem(KEY); } catch (e) { id = null; }
    if (id) return id;
    id = uuid();
    try { localStorage.setItem(KEY, id); } catch (e) { /* private mode: ephemeral id */ }
    return id;
  }

  window.JPShared.deviceId = {
    get: get
  };
})();
