// node --test server/test/merge-progress.test.mjs
// Guards the merge rules that protect user data across devices — especially
// the profile non-empty rule (a shipped-client bug used to push empty names).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeProgress } from '../lib/merge-progress.js';

const doc = (over) => ({ updatedAt: 1, ...over });

test('empty incoming profile never clobbers a stored name (incoming newer)', () => {
  const stored = doc({ updatedAt: 1, profile: { first: 'Joel', last: 'S', email: 'j@x.com' } });
  const incoming = doc({ updatedAt: 2, profile: { first: '', last: '', email: '' } });
  const m = mergeProgress(stored, incoming, 3);
  assert.equal(m.profile.first, 'Joel');
  assert.equal(m.profile.last, 'S');
  assert.equal(m.profile.email, 'j@x.com');
});

test('empty stored profile never blocks an incoming name (stored newer via skew)', () => {
  const stored = doc({ updatedAt: 5, profile: { first: '' } }); // server clock ahead
  const incoming = doc({ updatedAt: 2, profile: { first: 'Joel' } });
  const m = mergeProgress(stored, incoming, 6);
  assert.equal(m.profile.first, 'Joel');
});

test('newer non-empty name wins over older non-empty name', () => {
  const stored = doc({ updatedAt: 1, profile: { first: 'Old' } });
  const incoming = doc({ updatedAt: 2, profile: { first: 'New' } });
  assert.equal(mergeProgress(stored, incoming, 3).profile.first, 'New');
});

test('first write stores the incoming profile', () => {
  const m = mergeProgress(null, doc({ profile: { first: 'Joel' } }), 1);
  assert.equal(m.profile.first, 'Joel');
});

test('keikoWeek: later week wins wholesale', () => {
  const stored = doc({ gamify: { keikoWeek: { weekStart: '2026-06-22', earned: 90 } } });
  const incoming = doc({ updatedAt: 2, gamify: { keikoWeek: { weekStart: '2026-06-29', earned: 5 } } });
  const m = mergeProgress(stored, incoming, 3).gamify.keikoWeek;
  assert.deepEqual(m, { weekStart: '2026-06-29', earned: 5 });
});

test('keikoWeek: same week takes max', () => {
  const stored = doc({ gamify: { keikoWeek: { weekStart: '2026-06-29', earned: 40 } } });
  const incoming = doc({ updatedAt: 2, gamify: { keikoWeek: { weekStart: '2026-06-29', earned: 25 } } });
  assert.equal(mergeProgress(stored, incoming, 3).gamify.keikoWeek.earned, 40);
});

test('keikoWeek: missing incoming side never erases stored (old client PUT)', () => {
  const stored = doc({ gamify: { keikoWeek: { weekStart: '2026-06-29', earned: 40 } } });
  const incoming = doc({ updatedAt: 2, gamify: { keikoEarned: 10 } });
  assert.deepEqual(mergeProgress(stored, incoming, 3).gamify.keikoWeek, { weekStart: '2026-06-29', earned: 40 });
});

test('keikoWeek: both missing stays null (Firestore-safe)', () => {
  const m = mergeProgress(doc({ gamify: {} }), doc({ updatedAt: 2, gamify: {} }), 3);
  assert.equal(m.gamify.keikoWeek, null);
});
