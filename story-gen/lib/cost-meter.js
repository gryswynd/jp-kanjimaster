/**
 * story-gen/lib/cost-meter.js
 * Per-generation cost from Claude token usage. Mirrors the tutor's meter so the
 * story-gen dashboard reads the same shape. TTS/GCS costs get added here when
 * audio lands (2c).
 *
 * Input tokens come in THREE classes with different prices — fresh input (1×),
 * cache reads (0.1×), cache writes (1.25×). The incremental loop is dominated by
 * cache reads, so they must be priced separately (previously all were charged at
 * the full input rate, overstating cost ~10×). `rates` lets the judge (cheaper
 * model) be metered at its own price.
 */
import { COSTS } from './config.js';

export function computeCost(
  { inputTokens = 0, cacheReadTokens = 0, cacheCreationTokens = 0, outputTokens = 0 } = {},
  rates = COSTS,
) {
  const freshCents = inputTokens * rates.claudeInputPerToken * 100;
  const cacheReadCents = cacheReadTokens * rates.claudeInputPerToken * (rates.cacheReadMultiplier ?? 0.1) * 100;
  const cacheWriteCents = cacheCreationTokens * rates.claudeInputPerToken * (rates.cacheWriteMultiplier ?? 1.25) * 100;
  const claudeInputCents = freshCents + cacheReadCents + cacheWriteCents;
  const claudeOutputCents = outputTokens * rates.claudeOutputPerToken * 100;
  return {
    totalCents: claudeInputCents + claudeOutputCents,
    breakdown: { claudeInputCents, claudeOutputCents, cacheReadCents, cacheWriteCents },
  };
}
