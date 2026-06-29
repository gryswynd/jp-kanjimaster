/** story-gen/lib/errors.js — canonical { status, reason } error. */
export function httpError(status, reason) {
  const e = new Error(reason);
  e.status = status;
  e.reason = reason;
  return e;
}
