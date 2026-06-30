/**
 * app/shared/push.js
 * FCM push registration for "your story is ready" notifications. Registers
 * window.JPShared.push. INERT until the @capacitor/push-notifications plugin is
 * present (native build) AND the user is signed in — so it's a no-op in the web
 * build and before the plugin is installed.
 *
 * On a signed-in native device it asks permission, registers, sends the FCM
 * token to the story-gen service (storyGen.registerPush), and routes a tapped
 * "story ready" notification straight into the Stories reader.
 */
(function () {
  'use strict';
  window.JPShared = window.JPShared || {};

  function cap(name) { return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins[name]) || null; }
  function isNative() { return !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }
  function platform() { try { return (window.Capacitor && window.Capacitor.getPlatform && window.Capacitor.getPlatform()) || ''; } catch (e) { return ''; } }
  function notifyOn() { try { return localStorage.getItem('k-notify-on') !== '0'; } catch (e) { return true; } }
  function signedIn() {
    var a = window.JPShared.auth, u = a && a.currentUser && a.currentUser();
    return !!(u && !u.isAnonymous);
  }

  var registered = false, listenersAdded = false;

  async function init() {
    if (registered) return;
    var PN = cap('PushNotifications');
    var sg = window.JPShared.storyGen;
    if (!PN || !isNative() || !notifyOn()) return;
    if (!sg || !sg.isConfigured || !sg.isConfigured() || !signedIn()) return;

    if (!listenersAdded) {
      listenersAdded = true;
      PN.addListener('registration', function (t) {
        var tok = t && t.value;
        if (tok && sg.registerPush) { try { sg.registerPush(tok, platform()); } catch (e) {} }
      });
      PN.addListener('registrationError', function (e) { console.warn('[push] registration error', e && (e.error || e)); });
      PN.addListener('pushNotificationActionPerformed', function (a) {
        var data = a && a.notification && a.notification.data;
        if (data && data.type === 'story' && data.storyId && window.JPApp && window.JPApp.launch) {
          window.JPApp.launch('story', data.storyId, { category: 'custom' });
        }
      });
    }

    try {
      var perm = await PN.checkPermissions();
      if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') perm = await PN.requestPermissions();
      if (perm.receive === 'granted') { registered = true; await PN.register(); }
    } catch (e) { console.warn('[push] init failed', e && e.message); }
  }

  window.JPShared.push = { init: init, setEnabled: function (on) { try { localStorage.setItem('k-notify-on', on ? '1' : '0'); } catch (e) {} if (on) init(); } };

  // Try once at load and again whenever auth settles (the user may sign in later).
  window.addEventListener('jp-auth-changed', function () { init(); });
  setTimeout(function () { init(); }, 1500);
})();
