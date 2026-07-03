// node --test story-gen/test/summary.test.mjs
// summarizeUserDoc is the friend-roster data contract — keep its shape honest.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeUserDoc } from '../lib/store.js';

test('null doc → safe placeholder shape', () => {
  const s = summarizeUserDoc('u1', null);
  assert.equal(s.name, 'Friend');
  assert.equal(s.level, 'N5');
  assert.equal(s.lessonsCompleted, 0);
  assert.equal(s.streak, 0);
  assert.equal(s.weekKeiko, null);
  assert.equal(s.achievementCount, 0);
  assert.equal(s.masteredCount, 0);
});

test('full doc surfaces every roster stat', () => {
  const s = summarizeUserDoc('u2', {
    profile: { first: '  Aya  ' },
    learning: { lessonCompleted: { 'N5.1': true, 'N5.2': true, 'N4.3': true, G4: true } },
    streak: { current: 6, best: 21, lastActive: '2026-07-01' },
    gamify: {
      keikoWeek: { weekStart: '2026-06-29', earned: 85 },
      achievements: { 'first-lesson': 1, 'streak-7': 2 },
    },
    srs: { items: { 'N5:k_a': { r: 5 }, 'N5:k_b': { r: 4 }, 'N5:v_c': { r: 5 }, G7: { r: 5 } } },
  });
  assert.equal(s.name, 'Aya'); // trimmed by client display; server passes through trimmed check
  assert.equal(s.level, 'N4');
  assert.equal(s.lessonsCompleted, 4);
  assert.equal(s.streak, 6);
  assert.equal(s.streakBest, 21);
  assert.equal(s.lastActive, '2026-07-01');
  assert.deepEqual(s.weekKeiko, { weekStart: '2026-06-29', earned: 85 });
  assert.equal(s.achievementCount, 2);
  assert.equal(s.masteredCount, 3); // r===5 regardless of key kind
});

test('invalid keikoWeek normalizes to null', () => {
  const s = summarizeUserDoc('u3', { gamify: { keikoWeek: { earned: 10 } } });
  assert.equal(s.weekKeiko, null);
});
