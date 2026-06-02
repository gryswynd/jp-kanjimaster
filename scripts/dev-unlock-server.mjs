#!/usr/bin/env node
// Dev-only server for fully-unlocked local testing.
//
// Serves the repo root (the live source tree — app/, data/, data/audio, etc.)
// and, ONLY for index.html, injects `window.RIKIZO_CONFIG = { mode: 'free' }`
// before the page's gating script runs. That flips the unlock engine to "free"
// mode → every lesson/story/grammar/review + the Dojo (Scramble, Link Up, N4,
// Conjugation, Audio Dojo) is open, no progress required. The shipping
// index.html is never modified; this only rewrites the response in memory.
//
// Run:  node scripts/dev-unlock-server.mjs          (defaults to port 8300)
//       PORT=9000 node scripts/dev-unlock-server.mjs
// Then open http://localhost:8300/
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, normalize, extname } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.env.PORT || 8300);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.ico': 'image/x-icon'
};

const INJECT = "<script>window.RIKIZO_CONFIG={mode:'free'};/*dev-unlock*/</script>";

function injectFree(html) {
  // Put our script first so it runs before index.html's own gating line.
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, (m) => m + INJECT);
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, (m) => m + INJECT);
  return INJECT + html;
}

const server = createServer(async (req, res) => {
  try {
    let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    if (urlPath === '/' || urlPath === '') urlPath = '/index.html';
    // Prevent path traversal.
    const rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    let filePath = join(ROOT, rel);
    let s;
    try { s = await stat(filePath); } catch { res.writeHead(404); res.end('Not found'); return; }
    if (s.isDirectory()) { filePath = join(filePath, 'index.html'); }

    const isIndex = filePath.endsWith('/index.html');
    const buf = await readFile(filePath);
    const type = MIME[extname(filePath).toLowerCase()] || 'application/octet-stream';

    if (isIndex) {
      const html = injectFree(buf.toString('utf8'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
    } else {
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
      res.end(buf);
    }
  } catch (e) {
    res.writeHead(500); res.end('error: ' + (e && e.message));
  }
});

server.listen(PORT, () => {
  console.log(`Dev UNLOCKED server (mode:free) → http://localhost:${PORT}/`);
  console.log('Everything open: all lessons/stories/grammar/review + Dojo (Audio Dojo, Scramble, Link Up, N4).');
});
