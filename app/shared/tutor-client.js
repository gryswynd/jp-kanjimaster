/**
 * app/shared/tutor-client.js
 * Thin transport for the Rikizo tutor backend. Self-registers on
 * window.JPShared.tutorClient.
 *
 * V1 surface (Press-to-Ask):
 *   setConfig({ baseUrl, mock, timeoutMs })
 *   askPressToAsk({ text, audio, hint }) -> Promise<{ transcript, answer, quota }>
 *   getQuota()                            -> Promise<{ used, limit, remaining }>
 *   isMock()                              -> boolean
 *
 * Identity: every request carries the X-Device-Id header
 * (app/shared/device-id.js). Until a baseUrl is configured the client runs in
 * MOCK mode, so the Ask-Rikizo UI is fully exercisable before the Cloud Run
 * backend exists. Errors surface { status, reason } so callers can branch on
 * "tier_quota" / "daily_cost_cap" 429s.
 */

(function () {
  'use strict';

  window.JPShared = window.JPShared || {};

  var cfg = { baseUrl: '', mock: true, timeoutMs: 20000 };

  function setConfig(next) {
    next = next || {};
    if (typeof next.baseUrl === 'string') {
      cfg.baseUrl = next.baseUrl.replace(/\/+$/, '');
      cfg.mock = !cfg.baseUrl; // a real baseUrl implies live mode unless overridden
    }
    if (typeof next.mock === 'boolean') cfg.mock = next.mock;
    if (typeof next.timeoutMs === 'number') cfg.timeoutMs = next.timeoutMs;
  }

  function deviceId() {
    return (window.JPShared.deviceId && window.JPShared.deviceId.get()) || 'unknown';
  }

  function postJSON(path, body) {
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, cfg.timeoutMs) : null;
    return fetch(cfg.baseUrl + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-Id': deviceId() },
      body: JSON.stringify(body || {}),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error((data && data.reason) || ('HTTP ' + res.status));
          err.status = res.status;
          err.reason = data && data.reason;
          throw err;
        }
        return data;
      });
    }, function (e) {
      if (timer) clearTimeout(timer);
      throw e;
    });
  }

  // ---- Mock backend (used until a real baseUrl is configured) ----------------

  function mockAnswer(text) {
    var t = (text || '').trim();
    if (!t) return 'うーん、なにかきいてね！ (Hmm — ask me something!)';
    return 'いいしつもんだね！ Once Rikizo is connected to the tutor backend, ' +
           'I\'ll give you a real answer here. For now this is a placeholder so the ' +
           'screen works end to end. (mock mode)';
  }

  function mockAsk(payload) {
    return new Promise(function (resolve) {
      setTimeout(function () {
        var q = window.JPShared.tutorQuota ? window.JPShared.tutorQuota.getState() : null;
        resolve({
          transcript: (payload && payload.text) ? payload.text : '(voice question)',
          answer: mockAnswer(payload && payload.text),
          quota: q ? { used: q.used, limit: q.limit, remaining: q.remaining } : null,
          mock: true
        });
      }, 450);
    });
  }

  // ---- Public API ------------------------------------------------------------

  function askPressToAsk(payload) {
    payload = payload || {};
    if (cfg.mock || !cfg.baseUrl) return mockAsk(payload);
    return postJSON('/v1/press-to-ask', payload);
  }

  function getQuota() {
    if (cfg.mock || !cfg.baseUrl) {
      var q = window.JPShared.tutorQuota
        ? window.JPShared.tutorQuota.getState()
        : { used: 0, limit: 5, remaining: 5 };
      return Promise.resolve(q);
    }
    return fetch(cfg.baseUrl + '/v1/quota', { headers: { 'X-Device-Id': deviceId() } })
      .then(function (r) { return r.json(); });
  }

  window.JPShared.tutorClient = {
    setConfig: setConfig,
    askPressToAsk: askPressToAsk,
    getQuota: getQuota,
    isMock: function () { return cfg.mock || !cfg.baseUrl; }
  };
})();
