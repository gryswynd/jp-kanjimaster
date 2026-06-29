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

export async function anthropicCall({ system, messages, maxTokens }) {
  const res = await anthropic().messages.create({
    model: env.model,
    max_tokens: maxTokens || 4000,
    system,
    messages,
  });
  const text = (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  const u = res.usage || {};
  return {
    text,
    usage: {
      inputTokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
      outputTokens: u.output_tokens || 0,
    },
  };
}
