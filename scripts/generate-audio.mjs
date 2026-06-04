#!/usr/bin/env node
// Synthesizes every key in data/audio/keys.audio.json with Google Cloud
// Chirp 3 HD, transcodes to AAC/m4a (WKWebView-friendly), and writes
// data/audio/manifest.audio.json. Also builds Audio Dojo passage files
// (concatenated paragraph audio + breakpoints + waveform peaks).
//
// Incremental: a clip whose <hash>.m4a already exists is skipped (the hash is
// sha1 of the normalized key, so unchanged text = cache hit). Use --force to
// regenerate everything.
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
//      VOICE=Fenrir GOOGLE_TTS_API_KEY=... node scripts/generate-audio.mjs --force
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { keyHash } from './build-audio-manifest.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const FORCE = process.argv.includes('--force');
const VOICE = process.env.VOICE || 'Fenrir';
const VOICE_NAME = `ja-JP-Chirp3-HD-${VOICE}`;   // confirm exact id against the live API
const CONCURRENCY = Number(process.env.AUDIO_CONCURRENCY || 6);
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
async function synthMp3(text) {
  const body = {
    input: { text },
    voice: { languageCode: 'ja-JP', name: VOICE_NAME },
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

// Synthesize a single key into clips/<hash>.m4a (idempotent). Returns dur.
// Long keys are chunked + concatenated into one clip (see splitForTts).
async function ensureClip(key) {
  const hash = keyHash(key);
  const out = join(CLIPS_DIR, `${hash}.m4a`);
  if (!FORCE && existsSync(out)) return { hash, dur: probeDuration(out), cached: true };

  const chunks = splitForTts(key);
  if (chunks.length === 1) {
    const mp3 = await synthMp3(chunks[0]);
    mp3ToM4a(mp3, out, hash);
  } else {
    const partPaths = [];
    for (let i = 0; i < chunks.length; i++) {
      const mp3 = await synthMp3(chunks[i]);
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
    const { hash, cached } = await ensureClip(paras[i]);   // reuse the per-paragraph clip
    if (!cached) synthChars += paras[i].length;
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
function appendTtsLedger({ chars, voice, newClips, cachedClips }) {
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
  console.log(`Synthesizing ${items.length} clips with ${VOICE_NAME} (concurrency ${CONCURRENCY})...`);

  let made = 0, cached = 0, synthChars = 0;
  const failures = [];
  const clips = {};
  await pool(items, async (it) => {
    try {
      const { hash, dur, cached: wasCached } = await ensureClip(it.key);
      clips[it.key] = { file: `${hash}.m4a`, dur };
      if (wasCached) cached++; else { made++; synthChars += it.key.length; if (made % 200 === 0) console.log(`  ${made} synthesized...`); }
    } catch (e) {
      // Non-fatal: log and keep going so one bad input never aborts the batch.
      failures.push({ key: it.key, error: String(e && e.message || e).slice(0, 160) });
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
    schemaVersion: '1.0.0',
    voice: VOICE,
    voiceName: VOICE_NAME,
    basePath: 'data/audio/clips',
    format: 'm4a',
    clips
  };
  writeFileSync(join(AUDIO_DIR, 'manifest.audio.json'), JSON.stringify(manifest));
  rmSync(TMP_DIR, { recursive: true, force: true });
  appendTtsLedger({ chars: synthChars, voice: VOICE, newClips: made, cachedClips: cached });
  console.log(`Done. ${made} new, ${cached} cached. manifest.audio.json written (${Object.keys(clips).length} clips).`);
  if (failures.length) {
    console.warn(`\n⚠ ${failures.length} clip(s) failed (re-run to retry — successful clips are cached):`);
    for (const f of failures.slice(0, 20)) console.warn(`  ${JSON.stringify(f.key).slice(0, 80)} — ${f.error}`);
    if (failures.length > 20) console.warn(`  ...and ${failures.length - 20} more`);
  }
}

main().catch((e) => { console.error(String(e && e.message || e)); process.exit(1); });
