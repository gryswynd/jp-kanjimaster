#!/usr/bin/env node
// Synthesizes every key in data/audio/keys.audio.json with Google Cloud
// Chirp 3 HD, transcodes to AAC/m4a (WKWebView-friendly), and writes
// data/audio/manifest.audio.json. Also builds Audio Dojo passage files
// (concatenated paragraph audio + breakpoints + waveform peaks).
//
// Incremental: a clip whose <hash>.m4a already exists is skipped (the hash is
// sha1 of the normalized key + its voice, so unchanged text = cache hit). Use
// --force to regenerate everything.
//
// Conversation lines are synthesized in their speaker's voice; everything else
// (narration, glossary, kanji readings, Audio Dojo passages) uses the narrator.
//
// Requirements (build machine only — clips are committed, so the app stays
// offline):
//   - GOOGLE_TTS_API_KEY: a Google Cloud API key for the Cloud Text-to-Speech
//     API. Create it in console.cloud.google.com → APIs & Services →
//     Credentials → Create API key, enable the "Cloud Text-to-Speech API", and
//     (recommended) restrict the key to that API. API keys are NOT blocked by
//     the iam.disableServiceAccountKeyCreation org policy — only key FILES are.
//   - ffmpeg + ffprobe on PATH.
//
// Run: GOOGLE_TTS_API_KEY=... npm run gen:audio
//      GOOGLE_TTS_API_KEY=... node scripts/generate-audio.mjs --force
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { keyHash, NARRATOR } from './build-audio-manifest.mjs';
import { voiceKeyId } from './lib/audio-collect.mjs';
import { loadTtsNormalize } from './lib/load-normalize.mjs';

const norm = loadTtsNormalize();   // same reading overrides the key path uses (月よう日→げつようび)
const ROOT = new URL('..', import.meta.url).pathname;
const FORCE = process.argv.includes('--force');
// Each work-list item carries its own voice (the narrator for everything except
// conversation lines). There is deliberately no VOICE env override: it would
// synthesize narrator clips in another voice while still hashing them as the
// narrator's, silently poisoning every cached clip. Voices live in
// shared/characters.json; the roster is shared/chirp-voices.json.
const CONCURRENCY = Number(process.env.AUDIO_CONCURRENCY || 6);   // Chirp3 quota: 200 req/min
const API_KEY = process.env.GOOGLE_TTS_API_KEY || '';
const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';

const AUDIO_DIR = join(ROOT, 'data', 'audio');
const CLIPS_DIR = join(AUDIO_DIR, 'clips');
const TMP_DIR = join(AUDIO_DIR, '.tmp');

function sh(cmd, args) { return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] }); }

function ensureTools() {
  try { sh('ffmpeg', ['-version']); sh('ffprobe', ['-version']); }
  catch { throw new Error('ffmpeg/ffprobe not found on PATH — install ffmpeg.'); }
}

// Synthesize one string → MP3 bytes via Cloud TTS Chirp 3 HD (REST + API key).
// Retries transient 429/5xx/network errors with exponential backoff.
async function synthMp3(text, voice) {
  const body = {
    input: { text },
    voice: { languageCode: 'ja-JP', name: `ja-JP-Chirp3-HD-${voice || NARRATOR}` },
    audioConfig: { audioEncoding: 'MP3' }
  };
  let lastErr;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const res = await fetch(TTS_ENDPOINT + '?key=' + encodeURIComponent(API_KEY), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.status === 429 || res.status >= 500) throw new Error('retryable HTTP ' + res.status);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error('TTS HTTP ' + res.status + ': ' + txt.slice(0, 300));
      }
      const json = await res.json();
      if (!json.audioContent) throw new Error('no audioContent in response');
      return Buffer.from(json.audioContent, 'base64');
    } catch (e) {
      lastErr = e;
      if (!/retryable|fetch failed|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(String(e && e.message))) throw e;
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  throw lastErr;
}

// Chirp 3 HD rejects long inputs ("sentences that are too long"). Split over-
// length text on sentence/clause boundaries (last resort: hard chunks) so each
// request is safe; the pieces are concatenated back into ONE clip per key, so
// the whole paragraph still plays as a single unit (joined at natural pauses).
// Chirp 3 HD caps a request at ~130 chars (empirically: 130 ok, 140 → 400
// "sentences too long"). 120 leaves margin; only 1 sentence in the corpus
// exceeds it, so packing on sentence boundaries almost never splits a sentence.
const CHUNK_CHARS = 120;
function splitForTts(text) {
  if (text.length <= CHUNK_CHARS) return [text];
  const out = [];
  let cur = '';
  const push = () => { if (cur) { out.push(cur); cur = ''; } };
  for (const sentence of text.split(/(?<=[。！？!?])/)) {
    if (!sentence) continue;
    if (sentence.length > CHUNK_CHARS) {
      push();
      let sub = '';
      for (const clause of sentence.split(/(?<=[、,])/)) {
        if (clause.length > CHUNK_CHARS) {
          if (sub) { out.push(sub); sub = ''; }
          for (let i = 0; i < clause.length; i += CHUNK_CHARS) out.push(clause.slice(i, i + CHUNK_CHARS));
        } else if ((sub + clause).length > CHUNK_CHARS) { out.push(sub); sub = clause; }
        else sub += clause;
      }
      if (sub) out.push(sub);
    } else if ((cur + sentence).length > CHUNK_CHARS) { push(); cur = sentence; }
    else cur += sentence;
  }
  push();
  return out;
}

// MP3 buffer → AAC/m4a file (64k mono — plenty for speech, keeps bundle small).
// tag makes the temp filename unique so concurrent workers don't collide.
function mp3ToM4a(mp3Buf, outPath, tag) {
  const inTmp = join(TMP_DIR, tag + '.mp3');
  writeFileSync(inTmp, mp3Buf);
  sh('ffmpeg', ['-y', '-i', inTmp, '-c:a', 'aac', '-b:a', '64k', '-ac', '1', outPath]);
  try { rmSync(inTmp); } catch (e) {}
}

function probeDuration(path) {
  const out = sh('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nokey=1:noprint_wrappers=1', path]).toString().trim();
  return Math.round(parseFloat(out) * 1000) / 1000;
}

// Decode an audio file to a normalized waveform peaks array (N buckets, 0..1).
function computePeaks(path, buckets = 600) {
  const raw = sh('ffmpeg', ['-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '8000', '-']);
  const n = Math.floor(raw.length / 2);
  if (n === 0) return [];
  const per = Math.max(1, Math.floor(n / buckets));
  const peaks = [];
  for (let i = 0; i < n; i += per) {
    let max = 0;
    for (let j = i; j < Math.min(i + per, n); j++) {
      const s = Math.abs(raw.readInt16LE(j * 2));
      if (s > max) max = s;
    }
    peaks.push(Math.round((max / 32768) * 1000) / 1000);
  }
  return peaks;
}

// Simple promise pool.
async function pool(items, worker, limit) {
  const results = new Array(items.length);
  let idx = 0;
  async function run() {
    while (idx < items.length) {
      const i = idx++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

// Keys whose literal text Chirp can't voice well. The clip stays keyed/hashed
// by the ORIGINAL key — only the text sent to the synthesizer is substituted:
//   • bare small glides (ゃゅょ) come out as ~50ms of silence → speak the
//     full-size twin (same sound);
//   • some bare kana get clipped or mumbled → a trailing 。 fixes the prosody.
// (Ported from KanaMaster QA — standalone-kana clips there were audited by ear.)
const SYNTH_TEXT_OVERRIDES = {
  'ゃ': 'や', 'ゅ': 'ゆ', 'ょ': 'よ',
  'ャ': 'ヤ', 'ュ': 'ユ', 'ョ': 'ヨ',
  'す': 'す。', 'ス': 'ス。',
  'ず': 'ず。', 'ズ': 'ズ。',
  'ラ': 'ラ。',
  'わたし': '私',
  'さん': 'サン。', // katakana — phonetically unambiguous (kanji 三 got misread)
  'え': 'え？',      // "huh?" — the rising intonation IS the word
  'あっ': 'あっ！'
};

// Keys whose CLIP is borrowed wholesale from another key — KanaMaster QA found
// one script's synthesis reliably better than the other for the SAME sound
// (e.g. Chirp mangles bare あ but nails ア). The alias key's manifest entry
// points at the donor's clip file; no extra synthesis happens.
const CLIP_ALIASES = {
  // hiragana → katakana donors
  'あ': 'ア', 'い': 'イ', 'う': 'ウ', 'え': 'エ',
  'か': 'カ', 'き': 'キ',
  'せ': 'セ', 'そ': 'ソ',
  'じ': 'ジ',
  'た': 'タ', 'ち': 'チ', 'つ': 'ツ',
  'ぢ': 'ヂ',
  'な': 'ナ', 'に': 'ニ', 'ぬ': 'ヌ', 'ね': 'ネ', 'の': 'ノ',
  'は': 'ハ', 'ひ': 'ヒ', 'ふ': 'フ', 'へ': 'ヘ', 'ほ': 'ホ',
  'ば': 'バ', 'び': 'ビ', 'ぶ': 'ブ', 'べ': 'ベ', 'ぼ': 'ボ',
  'ら': 'ラ',
  'ん': 'ン',
  'ぴゃ': 'ピャ',
  // katakana → hiragana donors (the reverse cases)
  'シ': 'し',
  'ゼ': 'ぜ', 'ゾ': 'ぞ',
  // を is pronounced exactly like お
  'を': 'お', 'ヲ': 'お'
};

// Dedupe concurrent ensureClip calls for the same key+voice (donor + alias can
// land in different pool workers at the same moment).
const _inflight = new Map();
function ensureClipOnce(key, voice) {
  const id = voiceKeyId(key, voice);
  if (!_inflight.has(id)) _inflight.set(id, ensureClip(key, voice));
  return _inflight.get(id);
}

// Synthesize a single key into clips/<hash>.m4a (idempotent). Returns dur.
// Long keys are chunked + concatenated into one clip (see splitForTts).
async function ensureClip(key, voice = NARRATOR) {
  const hash = keyHash(key, voice);
  const out = join(CLIPS_DIR, `${hash}.m4a`);
  if (!FORCE && existsSync(out)) return { hash, dur: probeDuration(out), cached: true };

  // SYNTH_TEXT_OVERRIDES fixes isolated kana chips, which only the narrator ever
  // speaks — never let it rewrite a character's conversation line.
  const text = (voice === NARRATOR && SYNTH_TEXT_OVERRIDES[key]) || key;
  const chunks = splitForTts(text);
  if (chunks.length === 1) {
    const mp3 = await synthMp3(chunks[0], voice);
    mp3ToM4a(mp3, out, hash);
  } else {
    const partPaths = [];
    for (let i = 0; i < chunks.length; i++) {
      const mp3 = await synthMp3(chunks[i], voice);
      const pp = join(TMP_DIR, `${hash}_${i}.mp3`);
      writeFileSync(pp, mp3);
      partPaths.push(pp);
    }
    const listFile = join(TMP_DIR, `${hash}.concat.txt`);
    writeFileSync(listFile, partPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
    sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:a', 'aac', '-b:a', '64k', '-ac', '1', out]);
    partPaths.forEach((p) => { try { rmSync(p); } catch (e) {} });
    try { rmSync(listFile); } catch (e) {}
  }
  return { hash, dur: probeDuration(out), cached: false };
}

function listAudiostories() {
  const out = [];
  for (const lvl of ['N5', 'N4', 'N3', 'custom']) {
    const dir = join(ROOT, 'data', lvl, 'audiostories');
    if (!existsSync(dir)) continue;
    for (const slug of readdirSync(dir)) {
      const f = join(dir, slug, 'audiostory.json');
      if (existsSync(f)) out.push({ slug, lvl, file: f, dir: join(dir, slug) });
    }
  }
  return out;
}

// Build one audiostory's passage.m4a + breakpoints + peaks, write into its
// audio block. Each paragraph is read WHOLE by Chirp (natural prosody); we only
// join at paragraph boundaries. Returns the count of characters actually
// synthesized here (only non-cached paragraphs cost money) for the cost ledger.
async function buildPassage(story) {
  const data = JSON.parse(readFileSync(story.file, 'utf8'));
  const paras = (data.paragraphs || []).map((p) => (p.jp || '').trim()).filter(Boolean);
  if (!paras.length) return 0;

  const segPaths = [];
  const breakpoints = [];
  let cum = 0;
  let synthChars = 0;
  for (let i = 0; i < paras.length; i++) {
    // Synthesize the NORMALIZED text (reading overrides applied) so the passage
    // matches the keyed clips — e.g. 月よう日 reads げつようび, not "…ひ".
    const synthText = norm.normalizeKey(paras[i], null);
    // Audio Dojo passages are single-narrator narration — never per-character.
    const { hash, cached } = await ensureClip(synthText, NARRATOR);  // reuse the per-paragraph clip
    if (!cached) synthChars += synthText.length;
    const seg = join(CLIPS_DIR, `${hash}.m4a`);
    segPaths.push(seg);
    breakpoints.push(Math.round(cum * 1000) / 1000);
    cum += probeDuration(seg);
  }

  // Concatenate segments into one passage file.
  const listFile = join(TMP_DIR, `${story.slug}.concat.txt`);
  writeFileSync(listFile, segPaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join('\n'));
  const passagePath = join(story.dir, 'passage.m4a');
  sh('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', passagePath]);

  const dur = probeDuration(passagePath);
  const peaks = computePeaks(passagePath);
  data.audio = { file: 'passage.m4a', dur, breakpoints, peaks };
  writeFileSync(story.file, JSON.stringify(data, null, 2));
  console.log(`  passage: ${story.lvl}/${story.slug} — ${paras.length} paras, ${dur}s`);
  return synthChars;
}

// Append one run to the TTS cost ledger (data/audio/cost-ledger.json). Only chars
// ACTUALLY synthesized cost money (cached clips are free), so a no-op rebuild adds
// nothing. This is a build-time/developer cost — kept separate from runtime tutor
// cost on the admin dashboard. ~$30 per 1M chars for Chirp 3 HD.
const TTS_PRICE_PER_MILLION = 30;
function appendTtsLedger({ chars, voice, newClips, cachedClips, charsByVoice }) {
  if (!chars) return; // nothing synthesized → no cost to record
  const ledgerPath = join(AUDIO_DIR, 'cost-ledger.json');
  let ledger = { schemaVersion: '1.0.0', pricePerMillionChars: TTS_PRICE_PER_MILLION, runs: [] };
  if (existsSync(ledgerPath)) {
    try { ledger = JSON.parse(readFileSync(ledgerPath, 'utf8')); } catch { /* start fresh */ }
  }
  if (!Array.isArray(ledger.runs)) ledger.runs = [];
  const estUSD = Math.round((chars / 1e6) * TTS_PRICE_PER_MILLION * 100) / 100;
  ledger.runs.push({
    date: new Date().toISOString().slice(0, 10),
    chars, estUSD, voice, newClips, cachedClips,
    // Per-voice breakdown of what this run actually paid to synthesize. Absent
    // on runs that only touched the narrator.
    ...(charsByVoice && Object.keys(charsByVoice).length > 1 ? { charsByVoice } : {})
  });
  writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2));
  console.log(`Ledger: +${chars} chars (~$${estUSD.toFixed(2)}) → data/audio/cost-ledger.json`);
}

async function main() {
  if (!API_KEY) {
    throw new Error('Set GOOGLE_TTS_API_KEY — a Cloud Text-to-Speech API key ' +
      '(Console → Credentials → Create API key, with the Cloud Text-to-Speech API enabled).');
  }
  ensureTools();
  mkdirSync(CLIPS_DIR, { recursive: true });
  rmSync(TMP_DIR, { recursive: true, force: true });
  mkdirSync(TMP_DIR, { recursive: true });

  const worklistPath = join(AUDIO_DIR, 'keys.audio.json');
  if (!existsSync(worklistPath)) throw new Error('Run scripts/build-audio-manifest.mjs first.');
  const { items } = JSON.parse(readFileSync(worklistPath, 'utf8'));
  const voiceCount = new Set(items.map((it) => it.voice || NARRATOR)).size;
  console.log(`Synthesizing ${items.length} clips across ${voiceCount} voice(s) (concurrency ${CONCURRENCY})...`);

  let made = 0, cached = 0, synthChars = 0;
  const failures = [];
  const clips = {};          // narrator: key → {file, dur}
  const voices = {};         // voice → key → {file, dur}
  const charsByVoice = {};   // voice → chars actually synthesized (cost ledger)
  await pool(items, async (it) => {
    const voice = it.voice || NARRATOR;
    try {
      // Aliased keys reuse their donor's clip file outright. The donor table maps
      // isolated kana to a better-synthesized twin — narrator-only, like
      // SYNTH_TEXT_OVERRIDES; a character's line must never borrow another clip.
      const donor = voice === NARRATOR ? CLIP_ALIASES[it.key] : null;
      const { hash, dur, cached: wasCached } = await ensureClipOnce(donor || it.key, voice);
      const rec = { file: `${hash}.m4a`, dur };
      if (voice === NARRATOR) clips[it.key] = rec;
      else (voices[voice] = voices[voice] || {})[it.key] = rec;

      if (wasCached) cached++;
      else {
        made++;
        synthChars += it.key.length;
        charsByVoice[voice] = (charsByVoice[voice] || 0) + it.key.length;
        if (made % 200 === 0) console.log(`  ${made} synthesized...`);
      }
    } catch (e) {
      // Non-fatal: log and keep going so one bad input never aborts the batch.
      failures.push({ key: `${voice}: ${it.key}`, error: String(e && e.message || e).slice(0, 160) });
    }
  }, CONCURRENCY);

  // Audio Dojo passages (skip any that fail; don't abort the run).
  const stories = listAudiostories();
  if (stories.length) {
    console.log(`Building ${stories.length} audiostory passages...`);
    for (const s of stories) {
      try { synthChars += (await buildPassage(s)) || 0; }
      catch (e) { failures.push({ key: `passage:${s.lvl}/${s.slug}`, error: String(e && e.message || e).slice(0, 160) }); }
    }
  }

  const manifest = {
    schemaVersion: '2.0.0',
    voice: NARRATOR,               // the narrator; `voices` holds the cast
    voiceName: `ja-JP-Chirp3-HD-${NARRATOR}`,
    basePath: 'data/audio/clips',
    format: 'm4a',
    clips,
    voices
  };
  writeFileSync(join(AUDIO_DIR, 'manifest.audio.json'), JSON.stringify(manifest));
  rmSync(TMP_DIR, { recursive: true, force: true });
  appendTtsLedger({ chars: synthChars, voice: NARRATOR, newClips: made, cachedClips: cached, charsByVoice });
  const voicedClips = Object.values(voices).reduce((n, m) => n + Object.keys(m).length, 0);
  console.log(`Done. ${made} new, ${cached} cached. manifest.audio.json written ` +
    `(${Object.keys(clips).length} narrator + ${voicedClips} voiced clips).`);
  if (failures.length) {
    console.warn(`\n⚠ ${failures.length} clip(s) failed (re-run to retry — successful clips are cached):`);
    for (const f of failures.slice(0, 20)) console.warn(`  ${JSON.stringify(f.key).slice(0, 80)} — ${f.error}`);
    if (failures.length > 20) console.warn(`  ...and ${failures.length - 20} more`);
  }
}

main().catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
