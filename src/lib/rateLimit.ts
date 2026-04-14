// Simple in-memory rate limiter — per-operator, per-hour sliding window.
// Resets automatically via timestamp filtering. Survives only within a single
// Node process, which is adequate for MVP beta. For multi-instance prod,
// swap in Upstash/Redis.

type TierKey = 'haiku' | 'sonnet' | 'opus' | 'white_glove';

const LIMITS: Record<TierKey, number> = {
  haiku: 30,
  sonnet: 60,
  opus: 120,
  white_glove: 120,
};

const WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Map of operatorId → ring of timestamps
const hits = new Map<string, number[]>();

/**
 * Check + increment. Returns { allowed, remaining, limit, resetMs }.
 * If allowed is false, the caller should return 429.
 */
export function checkRateLimit(operatorId: string, tier: string | undefined): {
  allowed: boolean;
  remaining: number;
  limit: number;
  resetMs: number;
} {
  const t: TierKey = (tier as TierKey) in LIMITS ? (tier as TierKey) : 'haiku';
  const limit = LIMITS[t];
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  let arr = hits.get(operatorId) || [];
  // Drop entries outside the window
  arr = arr.filter(ts => ts > windowStart);

  if (arr.length >= limit) {
    hits.set(operatorId, arr);
    const oldest = arr[0];
    return {
      allowed: false,
      remaining: 0,
      limit,
      resetMs: Math.max(0, (oldest + WINDOW_MS) - now),
    };
  }

  arr.push(now);
  hits.set(operatorId, arr);
  return {
    allowed: true,
    remaining: limit - arr.length,
    limit,
    resetMs: WINDOW_MS,
  };
}
