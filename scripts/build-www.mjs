#!/usr/bin/env node
// Assembles the Capacitor web root (./www) from the app's runtime files only.
// Excludes design handoffs, the Webflow embed, scripts, and build output.
// Run: node scripts/build-www.mjs  (or: npm run build:www)
import { cp, rm, mkdir, readdir, stat, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const WWW = join(ROOT, 'www');

// Read appVersion/buildNumber straight from the index.html config literal so the
// bundled build and the hosted version.json share ONE source of truth (no drift).
async function readVersionFromIndex() {
  const html = await readFile(join(ROOT, 'index.html'), 'utf8');
  const num = (key) => {
    const m = new RegExp(key + '\\s*:\\s*(\\d+)').exec(html);
    return m ? parseInt(m[1], 10) : null;
  };
  const str = (key) => {
    const m = new RegExp(key + '\\s*:\\s*"([^"]*)"').exec(html);
    return m ? m[1] : null;
  };
  const buildNumber = num('buildNumber');
  const appVersion = str('appVersion');
  if (buildNumber == null || appVersion == null) {
    throw new Error('build-www: could not parse appVersion/buildNumber from index.html config');
  }
  return { appVersion, buildNumber };
}

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

  // version.json — the OTA manifest. Derived from index.html so it always matches
  // the bundled build. `notes` is a short changelog the update button can show.
  const { appVersion, buildNumber } = await readVersionFromIndex();
  const versionDoc = {
    appVersion,
    buildNumber,
    // Bundled builds carry no minNativeBuild gate; the HOSTED version.json may add
    // one to force a store/reinstall when a native change is required.
    minNativeBuild: 0,
    notes: '',
  };
  await writeFile(join(WWW, 'version.json'), JSON.stringify(versionDoc, null, 2) + '\n');

  // Report.
  const out = await readdir(WWW);
  console.log(`www/ built with ${out.length} top-level entries (build #${buildNumber}, v${appVersion}):`);
  console.log('  ' + out.sort().join('  '));
}

main().catch((e) => { console.error(e); process.exit(1); });
