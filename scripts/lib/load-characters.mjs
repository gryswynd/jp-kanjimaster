// Loads the browser-side app/shared/characters.js into a Node build script,
// the same way load-normalize.mjs loads tts-normalize.js.
//
// Speaker → voice resolution MUST be identical on both sides: the audio
// generator decides which voice a conversation line is synthesized under, and
// the runtime decides which voice's clip to look up. If the two ever fork, the
// line silently falls back to the narrator's clip instead of failing loudly.
// So there is exactly one implementation, and this is how Node reaches it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

export function loadCharacters() {
  const url = new URL('../../app/shared/characters.js', import.meta.url);
  const code = readFileSync(url, 'utf8');
  const sandbox = { self: {}, module: { exports: {} }, console, WeakMap };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'characters.js' });
  const mod = (sandbox.module.exports && sandbox.module.exports.voiceFor)
    ? sandbox.module.exports
    : (sandbox.self.JPShared && sandbox.self.JPShared.characters);
  if (!mod || typeof mod.voiceFor !== 'function') {
    throw new Error('load-characters: failed to load characters.js exports');
  }
  return mod;
}

/**
 * Build the ready-to-use voice resolver: the shared characters module with its
 * `roleVoices` configured, plus the character-only termMap `voiceFor` indexes
 * against (the browser passes its full glossary termMap; only `type:'character'`
 * entries matter, so a character-only map resolves identically).
 *
 * @returns {{ characters, termMap, roleVoices, narrator, roster, voiceFor }}
 */
export function loadVoiceResolver(root) {
  const characters = loadCharacters();
  const charJson = JSON.parse(readFileSync(join(root, 'shared', 'characters.json'), 'utf8'));
  const roster = JSON.parse(readFileSync(join(root, 'shared', 'chirp-voices.json'), 'utf8'));

  const termMap = {};
  for (const c of charJson.characters || []) if (c && c.id) termMap[c.id] = c;

  const roleVoices = charJson.roleVoices || {};
  characters.configureVoices(roleVoices, roster.narrator);

  return {
    characters,
    termMap,
    roleVoices,
    narrator: roster.narrator,
    roster,
    voiceFor: (spk, speakersMap) => characters.voiceFor(spk, speakersMap, termMap)
  };
}
