/**
 * server/lib/stt.js
 * Speech-to-Text via Groq's hosted Whisper. Returns { transcript, confidence, seconds }.
 *
 * WHY GROQ: the student speaks ENGLISH questions with Japanese words embedded
 * ("can you explain 失礼します?"). Google STT can't code-switch within one utterance
 * (it picks one language and drops the other — verified 2026-05-31). Whisper does
 * handle mixed speech, and Groq hosts it with a simple API key (no OAuth / service
 * account / org-policy blockers), off-device, and cheap (~$0.0018/min). We omit
 * the `language` param so Whisper auto-detects — its better mode for mixed audio.
 *
 * The client sends base64 audio + a short format tag; we wrap it as a file in a
 * multipart upload (Node 18+ global FormData/Blob). Duration billing is handled by
 * the caller from the client-reported clip length (Groq bills a 10s minimum).
 */

import { env } from './config.js';
import { httpError } from './errors.js';

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

// Short format tag → a filename extension + mime Groq/Whisper accepts.
const FORMATS = {
  webm: { ext: 'webm', mime: 'audio/webm' },
  opus: { ext: 'ogg', mime: 'audio/ogg' },
  ogg: { ext: 'ogg', mime: 'audio/ogg' },
  m4a: { ext: 'm4a', mime: 'audio/mp4' },
  mp4: { ext: 'm4a', mime: 'audio/mp4' },
  aac: { ext: 'm4a', mime: 'audio/mp4' },
  wav: { ext: 'wav', mime: 'audio/wav' },
  mp3: { ext: 'mp3', mime: 'audio/mpeg' },
};

export async function transcribe({ base64, format = 'webm' }) {
  if (!env.groqApiKey) throw httpError(503, 'stt_not_configured');
  if (!base64) return { transcript: '', confidence: 0, seconds: 0 };

  const fmt = FORMATS[format] || FORMATS.webm;
  const bytes = Buffer.from(base64, 'base64');

  const form = new FormData();
  // Blob from the raw bytes; the filename extension helps Whisper's demuxer.
  form.append('file', new Blob([bytes], { type: fmt.mime }), 'audio.' + fmt.ext);
  form.append('model', env.sttModel);
  form.append('response_format', 'json');
  form.append('temperature', '0');
  // NOTE: intentionally NO `language` field — auto-detect handles EN+JP mixed
  // better than forcing one language. A prompt nudges Whisper toward our domain.
  form.append('prompt', 'A student asks about Japanese, mixing English and Japanese (with kanji and kana).');

  const resp = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.groqApiKey },
    body: form,
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    const msg = (data && data.error && data.error.message) || ('HTTP ' + resp.status);
    console.error(JSON.stringify({ severity: 'ERROR', kind: 'stt_error', status: resp.status, msg }));
    throw httpError(502, 'stt_failed');
  }

  return {
    transcript: (data.text || '').trim(),
    confidence: 1, // Whisper/Groq json format doesn't return a confidence score
    seconds: 0,    // billed from the client-reported clip length in the route
  };
}
