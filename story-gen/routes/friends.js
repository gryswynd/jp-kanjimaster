/**
 * story-gen/routes/friends.js
 * Friend codes + mutual links + coarse progress. Account-only (Firebase token).
 *   GET    /v1/friends/me            → { code }
 *   POST   /v1/friends   { code }    → add by code (mutual) → { friend }
 *   GET    /v1/friends               → { friends: [ {uid,name,level,lessonsCompleted,streak} ] }
 *   DELETE /v1/friends/:uid          → remove (mutual)
 */
import express from 'express';
import { requireUid } from '../lib/auth.js';
import { ensureFriendCode, resolveFriendCode, addFriendMutual, removeFriend, listFriendUids, friendSummary } from '../lib/store.js';
import { httpError } from '../lib/errors.js';

export const friendsRouter = express.Router();

friendsRouter.get('/v1/friends/me', requireUid, async (req, res, next) => {
  try { res.json({ code: await ensureFriendCode(req.uid) }); }
  catch (e) { next(e); }
});

friendsRouter.post('/v1/friends', requireUid, async (req, res, next) => {
  try {
    const friendUid = await resolveFriendCode((req.body || {}).code);
    if (!friendUid) throw httpError(404, 'code_not_found');
    if (friendUid === req.uid) throw httpError(400, 'cannot_friend_self');
    await addFriendMutual(req.uid, friendUid);
    res.json({ friend: await friendSummary(friendUid) });
  } catch (e) { next(e); }
});

friendsRouter.get('/v1/friends', requireUid, async (req, res, next) => {
  try {
    const uids = await listFriendUids(req.uid);
    const friends = await Promise.all(uids.map(u => friendSummary(u)));
    friends.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    res.json({ friends });
  } catch (e) { next(e); }
});

friendsRouter.delete('/v1/friends/:uid', requireUid, async (req, res, next) => {
  try { await removeFriend(req.uid, req.params.uid); res.json({ ok: true }); }
  catch (e) { next(e); }
});
