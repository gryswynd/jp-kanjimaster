/**
 * server/lib/firebase.js
 * Lazy, tolerant firebase-admin wrapper used only to VERIFY Firebase ID tokens.
 *
 * Deliberately fault-tolerant: if firebase-admin isn't installed yet, or no
 * credentials are available (local dev), verifyIdToken() returns null instead of
 * throwing. That keeps the server (and the existing tutor endpoints) running; the
 * progress endpoints simply stay unauthenticated until the dep is installed and
 * the server is deployed on Cloud Run (where Application Default Credentials and
 * the project are auto-detected).
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
        if (!admin.apps || !admin.apps.length) {
          admin.initializeApp(); // ADC + auto project detection on Cloud Run
        }
        return admin;
      } catch (e) {
        _disabled = true;
        console.log(JSON.stringify({
          severity: 'NOTICE', kind: 'auth', firebaseAdmin: 'unavailable',
          error: String((e && e.message) || e),
        }));
        return null;
      }
    })();
  }
  return _adminPromise;
}

/** @returns decoded token ({ uid, email, ... }) or null if absent/invalid/unconfigured. */
export async function verifyIdToken(idToken) {
  if (!idToken) return null;
  const admin = await getAdmin();
  if (!admin) return null;
  try {
    return await admin.auth().verifyIdToken(idToken);
  } catch {
    return null;
  }
}
