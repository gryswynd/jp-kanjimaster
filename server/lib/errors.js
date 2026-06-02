/**
 * server/lib/errors.js
 * Canonical httpError used across stores + middleware so every layer throws the
 * same { status, reason } shape the client branches on.
 */
export function httpError(status, reason) {
  const e = new Error(reason);
  e.status = status;
  e.reason = reason;
  return e;
}
