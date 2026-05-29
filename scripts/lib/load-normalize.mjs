// Loads the browser-side app/shared/tts-normalize.js into a Node build script.
//
// The repo is "type":"module", so a runtime `.js` classic-script file can't be
// `require`d (Node would treat it as ESM) and has no `export`s. Instead we read
// its text and run it in a vm sandbox that provides the `module`/`self` globals
// the UMD wrapper looks for, then hand back the exported object. This guarantees
// the build pipeline and the browser use the EXACT same normalization code.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export function loadTtsNormalize() {
  const url = new URL('../../app/shared/tts-normalize.js', import.meta.url);
  const code = readFileSync(url, 'utf8');
  const sandbox = { self: {}, module: { exports: {} }, console };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'tts-normalize.js' });
  const mod = (sandbox.module.exports && sandbox.module.exports.normalizeKey)
    ? sandbox.module.exports
    : (sandbox.self.JPShared && sandbox.self.JPShared.ttsNormalize);
  if (!mod || typeof mod.normalizeKey !== 'function') {
    throw new Error('load-normalize: failed to load tts-normalize.js exports');
  }
  return mod;
}
