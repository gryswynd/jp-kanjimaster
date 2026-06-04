/**
 * server/lib/attest.js
 * iOS App Attest verification — the layer that makes device ids hard to forge
 * from non-app clients (blocks curl-to-quota-farm).
 *
 * Two flows:
 *   - attestKey(): one-time, on first launch — the client generates a key in the
 *     Secure Enclave and sends the CBOR attestation object. We verify the cert
 *     chain (Apple App Attest root), the nonce, the appId hash, and store the
 *     public key + receipt keyed by the device.
 *   - assertRequest(): per-request — the client signs (clientDataHash) with that
 *     key; we verify the assertion signature + monotonic counter.
 *
 * ⚠️ STATUS: the full CBOR parse + X.509 chain validation against the Apple root
 * is NOT implemented here — it requires a CBOR lib and the Apple App Attest root
 * cert, and is the one piece that must be completed before the beta accepts real
 * devices. The structure, storage hooks, and the ATTEST_BYPASS dev path are in
 * place so the rest of the server is testable now. See the TODOs below.
 */

import { env } from './config.js';
import { httpError } from './errors.js';

/**
 * Per-request gate used as Express middleware. With ATTEST_BYPASS=true (dev /
 * local / family-beta-before-attest-lands) it passes everything through but tags
 * req.attest so logs make the bypass obvious.
 */
export function attestMiddleware(req, res, next) {
  if (env.attestBypass) {
    req.attest = { verified: false, bypassed: true, keyId: null };
    return next();
  }
  const assertion = req.get('X-Attest-Assertion');
  const keyId = req.get('X-Attest-Key-Id');
  if (!assertion || !keyId) {
    return next(httpError(401, 'attest_required'));
  }
  verifyAssertion({ keyId, assertion, body: req.body, deviceId: req.deviceId })
    .then((ok) => {
      if (!ok) return next(httpError(401, 'attest_failed'));
      req.attest = { verified: true, bypassed: false, keyId };
      next();
    })
    .catch((e) => next(e));
}

// TODO(attest): implement against Apple's App Attest spec.
//   1. Parse the CBOR attestation, extract the credCert + caCert.
//   2. Verify the chain to Apple's App Attest Root CA.
//   3. Check nonce = SHA256(authData || clientDataHash); verify rpId hash ==
//      SHA256("<TEAMID>.<BUNDLEID>"); store public key + sign counter.
export async function attestKey() {
  throw httpError(501, 'attest_key_not_implemented');
}

// TODO(attest): verify the assertion signature with the stored public key and
// that the sign counter strictly increased (replay protection).
export async function verifyAssertion(/* { keyId, assertion, body, deviceId } */) {
  return false;
}

export function expectedAppId() {
  return `${env.appleTeamId}.${env.appBundleId}`;
}
