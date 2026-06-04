// app/shared/auth.js
// Firebase Authentication for the learning app. Registers window.JPShared.auth.
//
// INERT UNTIL CONFIGURED: if window.RIKIZO_FIREBASE is missing or has no apiKey,
// isEnabled() is false and every method no-ops, so the app behaves exactly as it
// does today (no network, no errors). It activates only once a real config block
// is present.
//
// Auth methods: silent ANONYMOUS sign-in (so a brand-new user has an account to
// attach progress to immediately) + EMAIL/PASSWORD. "Create account" links the
// anonymous user to an email in place, so nothing is lost. Apple/Google can be
// added later via a native Capacitor plugin (additive, no rework here).
//
// Uses the Firebase *compat* SDK loaded from the CDN as plain <script> tags —
// fits this app's no-bundler, classic-script loader. Auth only (no Firestore
// client SDK): data sync goes through our own server (see sync.js).
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};

  var SDK_VERSION = '10.14.1';
  var CDN = 'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/';

  var enabled = false;
  var fb = null;          // global firebase (compat)
  var authObj = null;     // firebase.auth()
  var readyPromise = null;

  function cfg() { return window.RIKIZO_FIREBASE || null; }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  function dispatch(user) {
    try {
      window.dispatchEvent(new CustomEvent('jp-auth-changed', { detail: { user: user || null } }));
    } catch (e) {}
  }

  // Resolves true when Firebase is loaded + the first auth state is known; false
  // if not configured or load failed. Safe to call repeatedly (memoized).
  function init() {
    if (readyPromise) return readyPromise;
    var c = cfg();
    if (!c || !c.apiKey) { enabled = false; readyPromise = Promise.resolve(false); return readyPromise; }
    enabled = true;
    readyPromise = (async function () {
      await loadScript(CDN + 'firebase-app-compat.js');
      await loadScript(CDN + 'firebase-auth-compat.js');
      fb = window.firebase;
      if (!fb || !fb.initializeApp) throw new Error('firebase compat SDK missing');
      if (!fb.apps || !fb.apps.length) fb.initializeApp(c);
      authObj = fb.auth();
      authObj.onAuthStateChanged(function (u) { dispatch(u); });
      // Wait for the first auth-state callback so callers know currentUser is settled.
      await new Promise(function (resolve) {
        var off = authObj.onAuthStateChanged(function () { off(); resolve(); });
      });
      return true;
    })().catch(function (e) {
      console.warn('[auth] init failed; staying local-only:', e && e.message);
      enabled = false;
      return false;
    });
    return readyPromise;
  }

  async function ensureSignedIn() {
    if (!(await init())) return null;
    if (!authObj.currentUser) {
      try { await authObj.signInAnonymously(); }
      catch (e) { console.warn('[auth] anonymous sign-in failed:', e && e.message); }
    }
    return authObj.currentUser || null;
  }

  async function getIdToken() {
    if (!enabled || !authObj || !authObj.currentUser) return null;
    try { return await authObj.currentUser.getIdToken(); }
    catch (e) { return null; }
  }

  function emailCred(email, pw) {
    return fb.auth.EmailAuthProvider.credential(email, pw);
  }

  async function signUpEmail(email, pw) {
    await init();
    // If the current user is anonymous, LINK (keep progress); else create fresh.
    var u = authObj.currentUser;
    if (u && u.isAnonymous) {
      var res = await u.linkWithCredential(emailCred(email, pw));
      return res.user;
    }
    var created = await authObj.createUserWithEmailAndPassword(email, pw);
    return created.user;
  }

  async function signInEmail(email, pw) {
    await init();
    var res = await authObj.signInWithEmailAndPassword(email, pw);
    return res.user;
  }

  async function signOut() {
    if (!enabled || !authObj) return;
    await authObj.signOut();
    // Drop back to a fresh anonymous identity so the app still functions.
    await ensureSignedIn();
  }

  function currentUser() { return (enabled && authObj && authObj.currentUser) || null; }
  function isEnabled() { return !!enabled; }
  function onChange(cb) {
    window.addEventListener('jp-auth-changed', function (e) { cb(e.detail && e.detail.user); });
  }

  // ── Minimal account modal ──────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('jp-auth-style')) return;
    var s = document.createElement('style');
    s.id = 'jp-auth-style';
    s.textContent = [
      '.jp-auth-ov{position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.42);display:flex;align-items:center;justify-content:center;padding:20px;}',
      '.jp-auth-card{width:100%;max-width:340px;background:var(--washi,#f5f3f0);color:var(--ink,#323029);border-radius:16px;padding:22px 20px calc(20px + env(safe-area-inset-bottom));box-shadow:0 18px 50px rgba(0,0,0,0.3);font-family:"Schibsted Grotesk","Work Sans",system-ui,sans-serif;}',
      '.jp-auth-title{font-family:"Noto Serif JP",serif;font-size:1.15rem;font-weight:700;margin:0 0 4px;}',
      '.jp-auth-sub{font-size:0.82rem;color:var(--ink-3,#8b8480);margin:0 0 16px;}',
      '.jp-auth-card label{display:block;font-size:0.72rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--ink-3,#8b8480);margin:10px 0 4px;}',
      '.jp-auth-card input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid var(--hairline,rgba(0,0,0,0.14));border-radius:10px;font-size:1rem;background:#fff;color:var(--ink,#323029);}',
      '.jp-auth-err{color:var(--vermilion,#c0392b);font-size:0.8rem;min-height:1.1em;margin-top:8px;}',
      '.jp-auth-btns{display:flex;flex-direction:column;gap:8px;margin-top:14px;}',
      '.jp-auth-btn{padding:12px;border-radius:999px;border:none;font:inherit;font-weight:700;cursor:pointer;}',
      '.jp-auth-btn.primary{background:var(--ink,#323029);color:var(--washi,#f5f3f0);}',
      '.jp-auth-btn.ghost{background:transparent;border:1px solid var(--hairline,rgba(0,0,0,0.14));color:var(--ink-2,#5d5852);}',
      '.jp-auth-x{float:right;background:none;border:none;font-size:1.2rem;cursor:pointer;color:var(--ink-3,#8b8480);line-height:1;}'
    ].join('');
    document.head.appendChild(s);
  }

  function openAccountUI() {
    if (!isEnabled()) {
      alert('Accounts are not set up yet.');
      return;
    }
    injectStyles();
    var u = currentUser();
    var signedInEmail = u && !u.isAnonymous ? u.email : null;

    var ov = document.createElement('div');
    ov.className = 'jp-auth-ov';
    ov.innerHTML =
      '<div class="jp-auth-card" role="dialog" aria-modal="true">' +
        '<button class="jp-auth-x" aria-label="Close">×</button>' +
        '<h2 class="jp-auth-title">' + (signedInEmail ? 'Your account' : 'Save your progress') + '</h2>' +
        '<p class="jp-auth-sub">' + (signedInEmail
            ? ('Signed in as ' + escHtml(signedInEmail))
            : 'Create an account so your progress is safe and follows you to other devices.') + '</p>' +
        (signedInEmail ? '' :
          '<label>Email</label><input class="jp-auth-email" type="email" autocomplete="email" inputmode="email">' +
          '<label>Password</label><input class="jp-auth-pw" type="password" autocomplete="current-password">') +
        '<div class="jp-auth-err"></div>' +
        '<div class="jp-auth-btns">' +
          (signedInEmail
            ? '<button class="jp-auth-btn ghost jp-auth-signout">Sign out</button>'
            : '<button class="jp-auth-btn primary jp-auth-create">Create account</button>' +
              '<button class="jp-auth-btn ghost jp-auth-signin">I already have an account</button>') +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);

    var errEl = ov.querySelector('.jp-auth-err');
    function close() { if (ov.parentNode) ov.parentNode.removeChild(ov); }
    function fail(e) { errEl.textContent = friendlyError(e); }
    function vals() {
      return {
        email: (ov.querySelector('.jp-auth-email') || {}).value || '',
        pw: (ov.querySelector('.jp-auth-pw') || {}).value || '',
      };
    }
    function afterAuth() {
      close();
      // Push local progress under the (now permanent) account, then pull/merge.
      try { if (window.JPShared.sync) window.JPShared.sync.push(); } catch (e) {}
    }

    ov.querySelector('.jp-auth-x').onclick = close;
    ov.onclick = function (e) { if (e.target === ov) close(); };

    var createBtn = ov.querySelector('.jp-auth-create');
    if (createBtn) createBtn.onclick = function () {
      var v = vals(); errEl.textContent = '';
      signUpEmail(v.email, v.pw).then(afterAuth).catch(fail);
    };
    var signinBtn = ov.querySelector('.jp-auth-signin');
    if (signinBtn) signinBtn.onclick = function () {
      var v = vals(); errEl.textContent = '';
      signInEmail(v.email, v.pw).then(afterAuth).catch(fail);
    };
    var signoutBtn = ov.querySelector('.jp-auth-signout');
    if (signoutBtn) signoutBtn.onclick = function () {
      signOut().then(close).catch(fail);
    };
  }

  function escHtml(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function friendlyError(e) {
    var code = (e && e.code) || '';
    if (code.indexOf('email-already-in-use') >= 0) return 'That email already has an account — try "I already have an account".';
    if (code.indexOf('invalid-email') >= 0) return 'That email address looks invalid.';
    if (code.indexOf('weak-password') >= 0) return 'Password should be at least 6 characters.';
    if (code.indexOf('wrong-password') >= 0 || code.indexOf('invalid-credential') >= 0) return 'Email or password is incorrect.';
    if (code.indexOf('user-not-found') >= 0) return 'No account found for that email.';
    if (code.indexOf('network') >= 0) return 'Network problem — check your connection.';
    return (e && e.message) || 'Something went wrong. Please try again.';
  }

  window.JPShared.auth = {
    init: init,
    isEnabled: isEnabled,
    whenReady: init,
    ensureSignedIn: ensureSignedIn,
    currentUser: currentUser,
    getIdToken: getIdToken,
    signUpEmail: signUpEmail,
    signInEmail: signInEmail,
    signOut: signOut,
    onChange: onChange,
    openAccountUI: openAccountUI,
  };
})();
