/**
 * story-gen/lib/anthropic.js
 * The injected Claude caller for the generation pipeline + the author system
 * prompt loader. Returns { text, usage:{inputTokens,outputTokens} } so the
 * pipeline can sum usage across repair rounds for cost metering.
 */
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { env } from './config.js';
import { httpError } from './errors.js';

const __dir = dirname(fileURLToPath(import.meta.url));
let client = null;
let authorCache = null;

function anthropic() {
  if (!env.anthropicKey) throw httpError(503, 'anthropic_not_configured');
  if (!client) client = new Anthropic({ apiKey: env.anthropicKey });
  return client;
}

export async function authorSystem() {
  if (authorCache == null) {
    authorCache = await readFile(join(__dir, '..', 'prompts', 'author.v1.md'), 'utf8');
  }
  return authorCache;
}

export async function anthropicCall({ system, messages, maxTokens, model }) {
  const res = await anthropic().messages.create({
    model: model || env.model,
    max_tokens: maxTokens || 4000,
    // Cache the system prompt (author rules + per-story scope + vocab palette) —
    // the incremental loop reuses it across ~30 small calls, so this slashes cost.
    system: typeof system === 'string' ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] : system,
    messages,
  });
  const text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const u = res.usage || {};
  // Keep the three input classes SEPARATE — they're priced 1× / 0.1× / 1.25×.
  return {
    text,
    usage: {
      inputTokens: u.input_tokens || 0,
      cacheReadTokens: u.cache_read_input_tokens || 0,
      cacheCreationTokens: u.cache_creation_input_tokens || 0,
      outputTokens: u.output_tokens || 0,
    },
  };
}
