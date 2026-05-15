// Anthropic per-call cost computation.
//
// Reference rates (per 1M tokens, USD) as of May 2026. Cache pricing
// uses Anthropic's published multipliers:
//   - Cache write 5-min ephemeral: 1.25× base input rate
//   - Cache write 1-hour:           2.0×  base input rate (not used here)
//   - Cache read:                   0.10× base input rate
//
// Cost model assumes 5-min ephemeral cache (Anthropic's default and
// what /api/gunny configures explicitly). If we move some calls to
// 1-hour TTL later, add a `cacheTtl: '5m' | '1h'` arg here and
// branch on it.

export interface AnthropicUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  /** Tokens read from cache (10% of input rate). */
  cache_read_input_tokens?: number | null;
  /** Tokens written to cache (125% of input rate, 5-min TTL). */
  cache_creation_input_tokens?: number | null;
}

interface RateCard {
  input: number;        // $/1M input tokens
  output: number;       // $/1M output tokens
  cacheRead: number;    // $/1M cache-read tokens (= input × 0.1)
  cacheWrite5m: number; // $/1M cache-write tokens (= input × 1.25)
}

/**
 * Per-1M-token rates per model family. Match conservatively on a
 * substring of the model id so 'claude-opus-4-6-20250101' and
 * 'claude-opus-4-7-20260201' both resolve to the Opus card. Unknown
 * models fall back to Sonnet rates (a reasonable midpoint).
 */
const RATES: Array<{ match: RegExp; rates: RateCard }> = [
  {
    match: /opus/i,
    rates: { input: 15.0, output: 75.0, cacheRead: 1.5, cacheWrite5m: 18.75 },
  },
  {
    match: /sonnet/i,
    rates: { input: 3.0, output: 15.0, cacheRead: 0.3, cacheWrite5m: 3.75 },
  },
  {
    match: /haiku/i,
    rates: { input: 0.8, output: 4.0, cacheRead: 0.08, cacheWrite5m: 1.0 },
  },
];

const FALLBACK_RATES: RateCard = {
  input: 3.0,
  output: 15.0,
  cacheRead: 0.3,
  cacheWrite5m: 3.75,
};

function resolveRates(model: string): RateCard {
  for (const { match, rates } of RATES) {
    if (match.test(model)) return rates;
  }
  return FALLBACK_RATES;
}

export interface CostBreakdown {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  inputCost: number;
  outputCost: number;
  cacheReadCost: number;
  cacheWriteCost: number;
  totalCost: number;
}

/**
 * Compute USD cost for a single Anthropic call.
 * Returns 0 across the board if usage is missing.
 */
export function computeAnthropicCost(model: string, usage: AnthropicUsage): CostBreakdown {
  const rates = resolveRates(model);
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  const cacheReadTokens = usage.cache_read_input_tokens ?? 0;
  const cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;

  // Input tokens reported by Anthropic EXCLUDE cache_read + cache_write
  // — they're the "fresh, non-cached" portion. So we bill them at the
  // full input rate. Cache reads bill at 10% input. Cache writes bill
  // at 125% input.
  const inputCost = (inputTokens * rates.input) / 1_000_000;
  const outputCost = (outputTokens * rates.output) / 1_000_000;
  const cacheReadCost = (cacheReadTokens * rates.cacheRead) / 1_000_000;
  const cacheWriteCost = (cacheWriteTokens * rates.cacheWrite5m) / 1_000_000;
  const totalCost = inputCost + outputCost + cacheReadCost + cacheWriteCost;

  return {
    inputTokens,
    outputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    inputCost: round6(inputCost),
    outputCost: round6(outputCost),
    cacheReadCost: round6(cacheReadCost),
    cacheWriteCost: round6(cacheWriteCost),
    totalCost: round6(totalCost),
  };
}

function round6(n: number): number {
  return Math.round(n * 1_000_000) / 1_000_000;
}
