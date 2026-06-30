/**
 * story-gen/routes/stories.js
 * Account-scoped custom-story endpoints. Generation is async: POST returns a job
 * id immediately and the work runs in the background (status written to
 * Firestore); the client polls jobs/:id.
 *
 *   POST /v1/stories/generate   { castIds, themes, gates, focusWords, ... } → { jobId }
 *   GET  /v1/stories/jobs/:id    → { status, storyId?, error?, rounds? }
 *   GET  /v1/stories             → [ { id, title, englishTitle, createdAt, ... } ]
 *   GET  /v1/stories/:id         → full story.json
 */
import express from 'express';
import { randomUUID } from 'node:crypto';
import { requireUid } from '../lib/auth.js';
import { reserveGeneration, createJob, getJob, listStories, getStory, saveStory, getPricingFlags, savePushToken, listFriendUids, friendSummary, getPushTokens, prunePushTokens } from '../lib/store.js';
import { sendPush } from '../lib/firebase.js';
import { toParams, runJob } from '../lib/generate-runner.js';
import { httpError } from '../lib/errors.js';

export const storiesRouter = express.Router();

storiesRouter.post('/v1/stories/generate', requireUid, async (req, res, next) => {
  try {
    const flags = await getPricingFlags();
    await reserveGeneration(req.uid);              // throws 429/503 on caps/kill-switch
    const storyId = (await import('node:crypto')).randomUUID();
    const params = toParams(req.body || {}, storyId, flags.maxParagraphs);
    const jobId = await createJob(req.uid, params);
    res.json({ jobId });                            // respond immediately
    // Background — not awaited. Survives on the always-on instance; terminal
    // state lands on the job doc for the client to poll.
    runJob(req.uid, req.userEmail || null, jobId, params);
  } catch (e) { next(e); }
});

storiesRouter.get('/v1/stories/jobs/:id', requireUid, async (req, res, next) => {
  try {
    const job = await getJob(req.uid, req.params.id);
    if (!job) throw httpError(404, 'job_not_found');
    res.json({ status: job.status, storyId: job.storyId || null, error: job.error || null, rounds: job.rounds || 0, violations: job.violations || null });
  } catch (e) { next(e); }
});

storiesRouter.get('/v1/stories', requireUid, async (req, res, next) => {
  try { res.json({ stories: await listStories(req.uid) }); }
  catch (e) { next(e); }
});

// Register this device's FCM push token (so we can ping when a story is ready).
storiesRouter.post('/v1/push/register', requireUid, async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.token) { res.json({ ok: false }); return; }
    await savePushToken(req.uid, String(b.token), String(b.platform || ''));
    res.json({ ok: true });
  } catch (e) { next(e); }
});

storiesRouter.get('/v1/stories/:id', requireUid, async (req, res, next) => {
  try {
    const story = await getStory(req.uid, req.params.id);
    if (!story) throw httpError(404, 'story_not_found');
    res.json({ story });
  } catch (e) { next(e); }
});

// Send a generated story to a friend — copies it into their library (with
// provenance) and notifies them. Requires an existing mutual friendship.
storiesRouter.post('/v1/stories/:storyId/share', requireUid, async (req, res, next) => {
  try {
    const friendUid = String((req.body || {}).friendUid || '');
    if (!friendUid) throw httpError(400, 'missing_friend');
    const friends = await listFriendUids(req.uid);
    if (!friends.includes(friendUid)) throw httpError(403, 'not_friends');
    const story = await getStory(req.uid, req.params.storyId);
    if (!story) throw httpError(404, 'story_not_found');
    const me = await friendSummary(req.uid);
    const newId = randomUUID();
    await saveStory(friendUid, { ...story, id: newId, sharedBy: { uid: req.uid, name: me.name } });
    try {
      const toks = await getPushTokens(friendUid);
      if (toks.length) {
        const dead = await sendPush(toks,
          { title: 'A friend sent you a story! 📖', body: `${me.name} shared "${story.title}"` },
          { type: 'story', storyId: newId });
        if (dead.length) await prunePushTokens(friendUid, dead);
      }
    } catch (e) { /* push best-effort */ }
    res.json({ ok: true });
  } catch (e) { next(e); }
});
