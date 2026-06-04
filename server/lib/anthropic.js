/**
 * server/lib/anthropic.js
 * Claude wrapper for Press-to-Ask. Uses Haiku with a prompt-cached pedagogy
 * persona + a `lookup_curriculum` tool, so Rikizo can reliably cite the lesson
 * where a vocab/grammar item was taught — even for typed/English questions the
 * client-side hint scan misses. Repeat questions read the cached system prompt at
 * 10% input price.
 *
 * Returns { answer, usage:{ inputTokens, outputTokens }, lookups:[query,...] }.
 * `lookups` feeds the cross-session learner profile (server/lib/profile.js).
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { env } from './config.js';
import { describeMatches } from './curriculum.js';

const __dir = dirname(fileURLToPath(import.meta.url));
let client = null;
let personaCache = null;

function anthropic() {
  if (!env.anthropicKey) throw httpError(503, 'anthropic_not_configured');
  if (!client) client = new Anthropic({ apiKey: env.anthropicKey });
  return client;
}

async function persona() {
  if (personaCache == null) {
    personaCache = await readFile(join(__dir, '..', 'prompts', 'persona.v1.md'), 'utf8');
  }
  return personaCache;
}

// One static tool. Stable definition → caches together with the persona (tools
// render before system in the cache prefix). Don't make this vary per request.
const TOOLS = [
  {
    name: 'lookup_curriculum',
    description:
      "Find which lesson or grammar point in THIS app's curriculum teaches a given " +
      'Japanese word or grammar pattern. Call this when you are about to tell the ' +
      'student where they learned something (or that it is coming up later) and you ' +
      'need the exact lesson/grammar id. Pass the Japanese form you are teaching ' +
      '(kana, kanji, or romaji — e.g. "なければ", "nakereba", "中止") OR an English ' +
      'grammar keyword (e.g. "te-form", "conditional", "potential", "counters"). ' +
      'Returns matching lesson/grammar ids with titles. Do NOT call it for general ' +
      'questions that are not about a specific curriculum item.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A Japanese word/grammar form (kana/kanji/romaji) or an English grammar keyword to locate in the curriculum.',
        },
      },
      required: ['query'],
    },
  },
];

const MAX_ITERS = 4; // initial call + up to a few tool round-trips, then stop.

/**
 * Answer one Press-to-Ask question, with on-demand curriculum lookup.
 * @param {string} question  the student's transcribed/typed question
 * @param {string} [hint]    optional per-request context (on-screen + progress + memory)
 * @param {object} flags     pricing-flags.pressAsk (maxOutputTokens etc.)
 */
export async function answerPressToAsk(question, hint, flags) {
  const system = [
    { type: 'text', text: await persona(), cache_control: { type: 'ephemeral' } },
  ];
  if (hint) {
    // Volatile, per-request — placed AFTER the cache breakpoint so it never
    // invalidates the cached persona+tools prefix.
    system.push({ type: 'text', text: `Current context:\n${hint}` });
  }

  const messages = [{ role: 'user', content: question }];
  const usage = { inputTokens: 0, outputTokens: 0 };
  const lookups = [];
  let answer = '';

  for (let i = 0; i < MAX_ITERS; i++) {
    const res = await anthropic().messages.create({
      model: env.anthropicModel,
      max_tokens: (flags && flags.maxOutputTokens) || 400,
      system,
      tools: TOOLS,
      messages,
    });

    const u = res.usage || {};
    usage.inputTokens += (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
    usage.outputTokens += u.output_tokens || 0;

    const textPart = (res.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (textPart) answer = textPart;

    if (res.stop_reason !== 'tool_use') break;

    // Preserve the full assistant turn (tool_use blocks included), then answer
    // each tool call and loop back for the final text.
    messages.push({ role: 'assistant', content: res.content });
    const toolResults = [];
    for (const block of res.content || []) {
      if (block.type !== 'tool_use') continue;
      if (block.name === 'lookup_curriculum') {
        const q = (block.input && block.input.query) || '';
        lookups.push(q);
        const resultText = await describeMatches(q);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: resultText });
      } else {
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Unknown tool.', is_error: true });
      }
    }
    messages.push({ role: 'user', content: toolResults });
  }

  return { answer, usage, lookups };
}

function httpError(status, reason) {
  const e = new Error(reason);
  e.status = status; e.reason = reason; return e;
}
