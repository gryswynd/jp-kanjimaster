// node --test server/test/progress-history.test.mjs
// Guards the revision-history recovery net (2026-07-06 progress-poisoning
// post-mortem): every saveProgress snapshots the PREVIOUS doc so a bad
// monotonic merge (fabricated completions can never be un-merged) is
// recoverable. Tests run against the memory store, which mirrors the
// Firestore users/{uid}/history/{ts} behavior.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { saveProgress, getProgress, getProgressHistory } from '../lib/store-memory.js';

const learning = (completed) => ({
  updatedAt: Date.now(),
  learning: { lessonCompleted: completed, lessonScores: {} },
});

test('first save records no history; second save snapshots the previous doc', async () => {
  const uid = 'hist-test-1';
  await saveProgress(uid, learning({ 'N5.1': true }));
  assert.equal(getProgressHistory(uid).length, 0, 'no previous doc on first save');

  await saveProgress(uid, learning({ 'N5.2': true }));
  const hist = getProgressHistory(uid);
  assert.equal(hist.length, 1);
  assert.deepEqual(Object.keys(hist[0].doc.learning.lessonCompleted), ['N5.1'],
    'history holds the pre-merge revision');

  const merged = await getProgress(uid);
  assert.ok(merged.learning.lessonCompleted['N5.1'] && merged.learning.lessonCompleted['N5.2'],
    'live doc is the merge of both saves');
});

test('history is capped', async () => {
  const uid = 'hist-test-2';
  for (let i = 0; i < 30; i++) {
    await saveProgress(uid, learning({ ['N5.' + (i + 1)]: true }));
  }
  const hist = getProgressHistory(uid);
  assert.ok(hist.length <= 20, 'kept at most HISTORY_KEEP revisions, got ' + hist.length);
  // Newest retained revision is from the most recent prior save.
  const newest = hist[hist.length - 1].doc.learning.lessonCompleted;
  assert.ok(newest['N5.29'], 'newest revision is the latest previous doc');
});
