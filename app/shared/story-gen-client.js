/**
 * app/shared/story-gen-client.js
 * Transport for the custom-story generator service (rikizo-story-gen). Talks to
 * config.storyGenBaseUrl with the user's Firebase ID token (mirrors sync.js auth).
 * Registers window.JPShared.storyGen.
 *
 *   generate(params) → { jobId }
 *   pollJob(jobId)   → { status, storyId?, error?, violations? }
 *   list()           → { stories: [...] }
 *   getStory(id)     → { story }
 *   isConfigured()   → bool
 */
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function baseUrl() {
    try { var qp = new URLSearchParams(location.search).get('storygen'); if (qp) return qp; } catch (e) {}
    var ls = lsGet('k-storygen-base-url'); if (ls) return ls;
    var c = (window.JPApp && window.JPApp.config) || {};
    return c.storyGenBaseUrl || '';
  }
  function authApi() { return window.JPShared && window.JPShared.auth; }

  async function token() {
    var a = authApi();
    if (!a || !a.getIdToken) return null;
    try { return await a.getIdToken(); } catch (e) { return null; }
  }
  function isSignedIn() {
    var a = authApi();
    var u = a && a.currentUser && a.currentUser();
    return !!(u && !u.isAnonymous);
  }

  async function req(method, path, body) {
    var base = baseUrl();
    if (!base) throw new Error('story generator not configured');
    var tok = await token();
    if (!tok) { var e = new Error('login_required'); e.code = 'login_required'; throw e; }
    var res = await fetch(base + path, {
      method: method,
      headers: Object.assign({ 'Authorization': 'Bearer ' + tok }, body ? { 'Content-Type': 'application/json' } : {}),
      body: body ? JSON.stringify(body) : undefined,
    });
    var data = null;
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) {
      var err = new Error((data && data.reason) || ('http_' + res.status));
      err.code = (data && data.reason) || ('http_' + res.status);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  window.JPShared.storyGen = {
    isConfigured: function () { return !!baseUrl(); },
    isSignedIn: isSignedIn,
    generate: function (params) { return req('POST', '/v1/stories/generate', params); },
    pollJob: function (jobId) { return req('GET', '/v1/stories/jobs/' + encodeURIComponent(jobId)); },
    list: function () { return req('GET', '/v1/stories'); },
    getStory: function (id) { return req('GET', '/v1/stories/' + encodeURIComponent(id)); },
    registerPush: function (token, platform) { return req('POST', '/v1/push/register', { token: token, platform: platform }); },
    // Friends (Phase 3)
    myFriendCode: function () { return req('GET', '/v1/friends/me'); },
    addFriend: function (code) { return req('POST', '/v1/friends', { code: code }); },
    listFriends: function () { return req('GET', '/v1/friends'); },
    removeFriend: function (uid) { return req('DELETE', '/v1/friends/' + encodeURIComponent(uid)); },
  };
})();
