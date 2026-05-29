/**
 * app/shared/user-profile.js
 * User profile store — first name, surname, email. Backed by localStorage.
 *
 * First name is the only field with meaningful UX behavior: when present, it
 * replaces "Rikizo-san" in the home greeting. Surname and email are captured
 * for future personalization (custom content, receipts) but unused today.
 *
 * Fires `jp-user-profile-changed` on document whenever set() is called, so the
 * home greeting (and anything else that wants to react) can re-render.
 *
 * No dependencies. Load early so the first render of the home masthead can
 * already see a previously-saved name.
 */
(function () {
  'use strict';

  window.JPShared = window.JPShared || {};
  if (window.JPShared.userProfile) return;

  var KEY_FIRST = 'k-user-first';
  var KEY_LAST  = 'k-user-last';
  var KEY_EMAIL = 'k-user-email';

  function _safeGet(k) {
    try { return localStorage.getItem(k) || ''; } catch (e) { return ''; }
  }
  function _safeSet(k, v) {
    try {
      var trimmed = (v || '').trim();
      if (trimmed) localStorage.setItem(k, trimmed);
      else localStorage.removeItem(k);
    } catch (e) { /* private mode, quota, etc. — silently ignore */ }
  }

  function getFirst() { return _safeGet(KEY_FIRST).trim(); }
  function getLast()  { return _safeGet(KEY_LAST).trim(); }
  function getEmail() { return _safeGet(KEY_EMAIL).trim(); }

  function get() {
    return { first: getFirst(), last: getLast(), email: getEmail() };
  }

  // Partial update — only keys present on the patch are written.
  function set(patch) {
    if (!patch || typeof patch !== 'object') return;
    var changed = false;
    if (Object.prototype.hasOwnProperty.call(patch, 'first')) {
      var nf = (patch.first || '').trim();
      if (nf !== getFirst()) { _safeSet(KEY_FIRST, nf); changed = true; }
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'last')) {
      var nl = (patch.last || '').trim();
      if (nl !== getLast()) { _safeSet(KEY_LAST, nl); changed = true; }
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'email')) {
      var ne = (patch.email || '').trim();
      if (ne !== getEmail()) { _safeSet(KEY_EMAIL, ne); changed = true; }
    }
    if (changed) {
      try {
        document.dispatchEvent(new CustomEvent('jp-user-profile-changed', { detail: get() }));
      } catch (e) { /* no CustomEvent on very old WebKit — fine */ }
    }
  }

  // Convenience for greetings: returns first name or the fallback (e.g. "Rikizo").
  function getGreetingName(fallback) {
    return getFirst() || (fallback || '');
  }

  // Simple email sanity check — not RFC-perfect, just "looks like an email".
  function isValidEmail(s) {
    if (!s) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
  }

  window.JPShared.userProfile = {
    get: get,
    set: set,
    getFirst: getFirst,
    getLast: getLast,
    getEmail: getEmail,
    getGreetingName: getGreetingName,
    isValidEmail: isValidEmail
  };
})();
