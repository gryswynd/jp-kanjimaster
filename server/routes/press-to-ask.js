/**
 * server/routes/press-to-ask.js
 * POST /v1/press-to-ask
 *
 * Body (JSON): { text?, audio?: { base64, format, sampleRateHertz }, hint? }
 *   - text  : a typed question (Compose / Dojo path — no STT cost)
 *   - audio : a recorded question (≤ maxAudioSeconds) → STT first
 * Exactly one of text|audio is required.
 *
 * Response: { transcript, answer, quota:{ used, limit, remaining } }
 *
 * Order of operations (cost-safe):
 *   1. resolve tier + check global kill switch / global cost breaker
 *   2. reserve a quota slot (atomic; 429 tier_quota / daily_cost_cap)
 *   3. STT if audio (skip Claude on low confidence — cheaper + better UX)
 *   4. Claude Haiku answer (cached persona)
 *   5. settle real cost; refund the slot on early failure
 */

import { Router } from 'express';
import {
  getEntitlement, getPricingFlags, getQuotaState,
  reservePressAsk, refundPressAsk, settleCost,
  getGlobalSpendCents, getProfile, httpError,
} from '../lib/store.js';
import { transcribe } from '../lib/stt.js';
import { answerPressToAsk } from '../lib/anthropic.js';
import { summarizeProfile, recordLookups } from '../lib/profile.js';
import { computeCostCents, logCost } from '../lib/cost-meter.js';

export const pressToAskRouter = Router();

pressToAskRouter.post('/v1/press-to-ask', async (req, res, next) => {
  const deviceId = req.deviceId;
  let reserved = false;
  try {
    const { text, audio, hint } = req.body || {};
    if (!text && !audio) throw httpError(400, 'missing_input');

    const flags = await getPricingFlags();
    if (flags.killSwitch) throw httpError(503, 'kill_switch');
    if ((await getGlobalSpendCents()) >= flags.maxDailyTotalUSD * 100) {
      throw httpError(503, 'global_cost_cap');
    }

    if (audio && audio.seconds && audio.seconds > flags.pressAsk.maxAudioSeconds) {
      throw httpError(413, 'audio_too_long');
    }

    const tier = await getEntitlement(deviceId);

    // Reserve BEFORE any paid work.
    const q = await reservePressAsk(deviceId, tier);
    reserved = true;

    const usage = { sttSeconds: 0, inputTokens: 0, outputTokens: 0 };
    let transcript = text || '';

    if (audio) {
      const r = await transcribe({
        base64: audio.base64, format: audio.format,
      });
      // Bill the client-reported clip length (single-chunk STT doesn't return
      // duration); the audio cap above bounds it to <= maxAudioSeconds.
      usage.sttSeconds = audio.seconds || r.seconds || 0;
      transcript = r.transcript;

      // Log what STT produced so finicky audio is debuggable from the terminal.
      console.log(JSON.stringify({
        severity: 'INFO', kind: 'stt_result',
        format: audio.format, seconds: audio.seconds,
        confidence: r.confidence, transcript: transcript,
      }));

      // Reject ONLY when STT returned nothing. Google's `latest_short` model
      // often reports confidence 0 even for good transcripts, so a confidence
      // floor causes false "didn't understand" rejections — don't gate on it.
      if (!transcript) {
        // Nothing transcribed — refund and ask again (no Claude spend).
        await refundPressAsk(deviceId);
        reserved = false;
        const cents = computeCostCents(usage);
        await settleCost(deviceId, cents);
        logCost('press-to-ask/low-confidence', deviceId, usage, cents);
        return res.json({
          transcript,
          answer: '聞き取れなかったよ。もう一度言ってね。 (I didn\'t catch that — say it again?)',
          quota: await getQuotaState(deviceId, tier),
        });
      }
    }

    // Cross-session memory: prepend a compact "things you've asked before" block
    // to the (volatile) per-request context. Server is source of truth here; the
    // client hint already carries on-screen + progress.
    let memHint = '';
    try { memHint = summarizeProfile(await getProfile(deviceId)); } catch { /* best-effort */ }
    const fullHint = [memHint, hint].filter(Boolean).join('\n\n');

    const { answer, usage: llm, lookups } = await answerPressToAsk(transcript, fullHint, flags.pressAsk);
    usage.inputTokens = llm.inputTokens;
    usage.outputTokens = llm.outputTokens;

    const cents = computeCostCents(usage);
    await settleCost(deviceId, cents);
    logCost('press-to-ask', deviceId, usage, cents);

    // Update the learner profile with what Rikizo looked up (fire-and-forget — a
    // cheap store write, no model call; never block the response on it).
    const level = (hint && (hint.match(/Working in level:\s*([A-Z0-9]+)/) || [])[1]) || null;
    recordLookups(deviceId, lookups, level).catch(() => {});

    res.json({ transcript, answer, quota: await getQuotaState(deviceId, tier) });
  } catch (e) {
    if (reserved) await refundPressAsk(deviceId);
    next(e);
  }
});
