/**
 * story-gen/lib/cost-meter.js
 * Per-generation cost from Claude token usage. Mirrors the tutor's meter so the
 * story-gen dashboard reads the same shape. TTS/GCS costs get added here when
 * audio lands (2c).
 */
import { COSTS } from './config.js';

export function computeCost({ inputTokens = 0, outputTokens = 0 }) {
  const claudeInputCents = inputTokens * COSTS.claudeInputPerToken * 100;
  const claudeOutputCents = outputTokens * COSTS.claudeOutputPerToken * 100;
  return {
    totalCents: claudeInputCents + claudeOutputCents,
    breakdown: { claudeInputCents, claudeOutputCents },
  };
}
