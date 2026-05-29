#!/usr/bin/env node
// Assembles the Capacitor web root (./www) from the app's runtime files only.
// Excludes design handoffs, the Webflow embed, scripts, and build output.
// Run: node scripts/build-www.mjs  (or: npm run build:www)
import { cp, rm, mkdir, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const WWW = join(ROOT, 'www');

// Directories copied verbatim into www/.
const DIRS = ['app', 'shared', 'data', 'assets', 'vendor', 'fonts'];

// Root files always included.
const FILES = ['index.html', 'door.png'];

// Root files matched by extension (feature modules + rule/data JSON).
const EXT = ['.js', '.json'];

// Root files matched by EXT but excluded from the web bundle (build tooling).
const EXCLUDE = new Set(['package.json', 'package-lock.json', 'capacitor.config.ts']);

async function main() {
  await rm(WWW, { recursive: true, force: true });
  await mkdir(WWW, { recursive: true });

  for (const d of DIRS) {
    const src = join(ROOT, d);
    try { await stat(src); } catch { console.warn(`skip missing dir: ${d}`); continue; }
    await cp(src, join(WWW, d), { recursive: true });
  }

  const explicit = new Set(FILES);
  for (const name of FILES) {
    try { await cp(join(ROOT, name), join(WWW, name)); }
    catch { console.warn(`skip missing file: ${name}`); }
  }

  for (const name of await readdir(ROOT)) {
    if (explicit.has(name) || EXCLUDE.has(name)) continue;
    if (!EXT.some((e) => name.endsWith(e))) continue;
    const s = await stat(join(ROOT, name));
    if (!s.isFile()) continue;
    await cp(join(ROOT, name), join(WWW, name));
  }

  // Report.
  const out = await readdir(WWW);
  console.log(`www/ built with ${out.length} top-level entries:`);
  console.log('  ' + out.sort().join('  '));
}

main().catch((e) => { console.error(e); process.exit(1); });
