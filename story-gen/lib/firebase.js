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
