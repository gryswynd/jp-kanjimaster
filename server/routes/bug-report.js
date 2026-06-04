/**
 * server/routes/bug-report.js
 * POST /v1/bug-report — beta bug reports → Firestore bug-reports/{auto-id}.
 *
 * Requires a device id (identity middleware). An account is NOT required, so a
 * tester can report a bug whether or not they've signed in. Mounted before the
 * rate-limit / attest gates (those protect the cost-bearing tutor endpoints).
 *
 * Body (JSON): {
 *   category: 'chipping'|'audio'|'romaji'|'furigana'|'tutor'|'other',
 *   note?: string,
 *   context?: { version, device, app, errors, capturedAt }   // from diagnostics.snapshot()
 * }
 * Response: { ok: true, id }
 */

import { Router } from 'express';
import { saveBugReport, httpError } from '../lib/store.js';

export const bugReportRouter = Router();

const CATEGORIES = ['chipping', 'audio', 'romaji', 'furigana', 'tutor', 'other'];
const MAX_NOTE = 2000;
const MAX_CONTEXT_BYTES = 16 * 1024; // generous for the diagnostics snapshot; rejects abuse

bugReportRouter.post('/v1/bug-report', async (req, res, next) => {
  try {
    const body = req.body || {};
    const category = String(body.category || 'other').toLowerCase();
    if (CATEGORIES.indexOf(category) < 0) throw httpError(400, 'bad_category');

    const note = typeof body.note === 'string' ? body.note.slice(0, MAX_NOTE) : '';

    // Context is best-effort and untrusted — cap its size and store as-is.
    let context = body.context && typeof body.context === 'object' ? body.context : {};
    try {
      if (JSON.stringify(context).length > MAX_CONTEXT_BYTES) {
        // Drop the most likely-large field (errors) rather than reject the report.
        context = { ...context, errors: '[omitted: too large]' };
      }
    } catch (e) {
      context = { note: '[context unserializable]' };
    }

    const report = {
      category,
      note,
      context,
      deviceId: req.deviceId || null,
      uid: req.uid || null,           // present if the tester is signed in
      userEmail: req.userEmail || null,
      reportedAt: new Date().toISOString(),
    };

    const id = await saveBugReport(report);
    res.json({ ok: true, id });
  } catch (e) {
    next(e);
  }
});
