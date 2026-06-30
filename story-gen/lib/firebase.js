/**
 * story-gen/lib/firebase.js
 * Lazy, tolerant firebase-admin wrapper — verifies Firebase ID tokens only.
 * Same project as the tutor, so Application Default Credentials on Cloud Run
 * verify the same tokens with no extra config. Returns null (never throws) when
 * unavailable, so local dev runs without credentials.
 */
let _adminPromise = null;
let _disabled = false;

async function getAdmin() {
  if (_disabled) return null;
  if (!_adminPromise) {
    _adminPromise = (async () => {
      try {
        const mod = await import('firebase-admin');
        const admin = mod.default || mod;
        if (!admin.apps || !admin.apps.length) admin.initializeApp();
        return admin;
      } catch (e) {
        _disabled = true;
        console.log(JSON.stringify({ severity: 'NOTICE', kind: 'auth', firebaseAdmin: 'unavailable', error: String((e && e.message) || e) }));
        return null;
      }
    })();
  }
  return _adminPromise;
}

export async function verifyIdToken(idToken) {
  if (!idToken) return null;
  const admin = await getAdmin();
  if (!admin) return null;
  try { return await admin.auth().verifyIdToken(idToken); }
  catch { return null; }
}

/**
 * Send a push to a set of FCM tokens. Returns the list of tokens that are no
 * longer valid (so the caller can prune them). No-ops if admin is unavailable.
 */
export async function sendPush(tokens, notification, data) {
  const list = (tokens || []).filter(Boolean);
  if (!list.length) return [];
  const admin = await getAdmin();
  if (!admin) return [];
  try {
    const msg = {
      tokens: list,
      notification,
      data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])),
      // High-priority Android notification config — this is what reliably shows in
      // the tray when the app is backgrounded (verified on device).
      android: { priority: 'high', notification: { channelId: 'default', priority: 'max', defaultSound: true } },
      apns: { payload: { aps: { sound: 'default' } } },
    };
    const res = await admin.messaging().sendEachForMulticast(msg);
    const dead = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error && r.error.code;
        if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') dead.push(list[i]);
      }
    });
    return dead;
  } catch (e) {
    console.log(JSON.stringify({ severity: 'WARNING', kind: 'push', error: String((e && e.message) || e) }));
    return [];
  }
}
