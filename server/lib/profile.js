/**
 * server/lib/profile.js
 * Cross-session learner memory. A tiny, device-scoped, SUMMARIZED profile of what
 * a student keeps asking Rikizo about — so Rikizo can say "you've been curious
 * about なる a few times, here's a deeper look" across sessions.
 *
 * Privacy: device-keyed, summarized counts only — NO transcripts, NO PII. These
 * may be minors; keep it minimal. See the architecture doc:
 * /Users/joel/.claude/plans/partitioned-dancing-sifakis.md
 *
 * Profile shape (capped, a few KB):
 *   { asked: { "<item>": count }, lastLevel: "N4", updatedAt: <ms> }
 */

import { getProfile, saveProfile } from './store.js';

const MAX_ASKED = 12;        // keep at most the top-N asked items
const RECUR_THRESHOLD = 2;   // asked this many times → worth surfacing
const SURFACE_MAX = 5;       // how many to mention in the context block
const KEY_MAX_LEN = 40;

/** Compact text block injected into the per-request context (or '' if nothing). */
export function summarizeProfile(profile) {
  if (!profile || !profile.asked) return '';
  const recurring = Object.entries(profile.asked)
    .filter(([, c]) => c >= RECUR_THRESHOLD)
    .sort((a, b) => b[1] - a[1])
    .slice(0, SURFACE_MAX)
    .map(([k]) => k);
  if (!recurring.length) return '';
  return 'STUDENT MEMORY (things this student has asked about before across sessions — ' +
    'connect your answer to these when relevant, and you may warmly acknowledge their ' +
    'recurring curiosity): ' + recurring.join(', ');
}

/**
 * Record the curriculum items looked up while answering, into the device profile.
 * Fire-and-forget from the route (cheap store write, no model call).
 */
export async function recordLookups(deviceId, lookups, level) {
  if (!deviceId || !lookups || !lookups.length) return;
  let profile;
  try { profile = await getProfile(deviceId); } catch { profile = null; }
  profile = profile || { asked: {}, lastLevel: null };
  profile.asked = profile.asked || {};

  for (const q of lookups) {
    const key = String(q || '').trim().slice(0, KEY_MAX_LEN);
    if (!key) continue;
    profile.asked[key] = (profile.asked[key] || 0) + 1;
  }

  // Cap size: keep only the most-asked items.
  const top = Object.entries(profile.asked).sort((a, b) => b[1] - a[1]).slice(0, MAX_ASKED);
  profile.asked = Object.fromEntries(top);
  if (level) profile.lastLevel = level;
  profile.updatedAt = Date.now();

  try { await saveProfile(deviceId, profile); } catch { /* best-effort memory */ }
}
