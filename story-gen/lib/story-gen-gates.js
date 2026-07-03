/**
 * story-gen/lib/story-gen-gates.js
 * Server-side enforcement of theme + length gating. The client (CustomStoryBuilder)
 * greys locked chips, but client locks are bypassable — this rejects a locked
 * request at the route BEFORE a quota slot or any Claude call is spent.
 * Source of truth: shared/story-gen-gates.json (staged to <contentRoot>/shared/).
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from './config.js';

let _gatesPromise = null;
function loadGates() {
  if (!_gatesPromise) {
    const p = path.join(env.contentRoot, 'shared/story-gen-gates.json');
    _gatesPromise = readFile(p, 'utf8').then(JSON.parse).catch((e) => {
      // Fail open (gating off beats blocking every generation) but say so, and
      // don't memoize the failure — a transient read error self-heals next request.
      console.error(`story-gen-gates: load failed (${e.message}) — gating disabled for this request`);
      _gatesPromise = null;
      return { themes: {}, lengths: {} };
    });
  }
  return _gatesPromise;
}

// rank = (5 - Nlevel) * 1000 + index → N5.1=1, N4.1=1001, N3.1=2001 (monotonic).
export function lessonRank(id) {
  const m = /^N([345])\.(\d+)$/.exec(String(id || ''));
  return m ? (5 - +m[1]) * 1000 + +m[2] : 0;
}
// Floor at 1 (N5.1): everyone can read that far even before completing a lesson.
export function learnerRank(furthestLesson) {
  return Math.max(lessonRank(furthestLesson), 1);
}

// Returns { ok, reason?, locked[] } — locked lists offending {kind,value,unlocksAt}.
// reason is 'length_locked' when only the length is out of reach, else 'theme_locked'.
export async function checkGates({ themes = [], targetParagraphs, furthestLesson }) {
  const gates = await loadGates();
  const rank = learnerRank(furthestLesson);
  const locked = [];
  for (const t of themes) {
    const need = gates.themes && gates.themes[t];
    if (need && lessonRank(need) > rank) locked.push({ kind: 'theme', value: t, unlocksAt: need });
  }
  const lengths = gates.lengths || {};
  if (Object.keys(lengths).length) {
    // The gate keys ARE the menu (8/14/22/28) — the client can't send anything
    // else, so an unlisted value is a crafted request. Treat it as locked rather
    // than letting it skip the gate via the exact-key lookup.
    const lenKey = String(targetParagraphs);
    const lenNeed = lengths[lenKey];
    if (!lenNeed || lessonRank(lenNeed) > rank) locked.push({ kind: 'length', value: lenKey, unlocksAt: lenNeed || null });
  }
  if (!locked.length) return { ok: true, locked: [] };
  const reason = locked.every((l) => l.kind === 'length') ? 'length_locked' : 'theme_locked';
  return { ok: false, reason, locked };
}
