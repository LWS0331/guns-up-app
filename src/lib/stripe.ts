import Stripe from 'stripe';

// Stripe singleton
let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY not configured');
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripeInstance;
}

// Tier → Stripe Price mapping (set these in Railway env vars).
//
// Pricing Strategy v3 (May 2026 — supersedes v2):
//   - RECON stays FREE with hard caps (30 chats/24h, 5 workout gens/7d).
//   - OPERATOR raised to $19.99/mo (was $9.99). Sonnet brain, ~50 msg/day
//     soft cap, Auto-routes simple queries to Haiku to control COGS.
//   - COMMANDER raised to $39.99/mo (was $14.99). Sonnet unlimited +
//     $15/mo of Opus credits at API cost — falls back to Sonnet when burned.
//   - WARFIGHTER raised to $149/mo (was $49.99). Concierge tier — unlimited
//     Opus + monthly 1:1 with Ruben. Hard cap at 25 seats.
//   - NEW: JUNIOR OPERATOR ($24.99) and JUNIOR ELITE ($49.99) — Britney-led
//     youth track, ages 8–17, parent-managed, SafeSport-aligned.
//
// Why the price hike: observed v2 COGS at ~$163/user/mo on Opus without
// caching (vs. $0.56 modeled). Even with caching + Auto routing landing,
// projected blended COGS is $5–30/user/mo depending on tier. New prices
// rebuild margin. See GUNS_UP_Master_Plan_v2.md for full unit economics.
export const TIER_PRICES: Record<string, { monthly: string; annual: string; name: string; amount: number; free?: boolean }> = {
  haiku: {
    monthly: process.env.STRIPE_PRICE_RECON_MONTHLY || 'price_recon_monthly',
    annual: process.env.STRIPE_PRICE_RECON_ANNUAL || 'price_recon_annual',
    name: 'RECON',
    amount: 0,
    free: true,
  },
  sonnet: {
    monthly: process.env.STRIPE_PRICE_OPERATOR_MONTHLY || 'price_operator_monthly',
    annual: process.env.STRIPE_PRICE_OPERATOR_ANNUAL || 'price_operator_annual',
    name: 'OPERATOR',
    amount: 1999, // $19.99 (v3 — May 2026; raised from $9.99 to align with COGS)
  },
  opus: {
    monthly: process.env.STRIPE_PRICE_COMMANDER_MONTHLY || 'price_commander_monthly',
    annual: process.env.STRIPE_PRICE_COMMANDER_ANNUAL || 'price_commander_annual',
    name: 'COMMANDER',
    amount: 3999, // $39.99 (v3 — May 2026; raised from $14.99; includes $15 Opus credits)
  },
  white_glove: {
    monthly: process.env.STRIPE_PRICE_WARFIGHTER_MONTHLY || 'price_warfighter_monthly',
    annual: process.env.STRIPE_PRICE_WARFIGHTER_ANNUAL || 'price_warfighter_annual',
    name: 'WARFIGHTER',
    amount: 14900, // $149.00 (v3 — May 2026; raised from $49.99; concierge tier with 25-seat cap)
  },
  junior_sonnet: {
    monthly: process.env.STRIPE_PRICE_JUNIOR_OPERATOR_MONTHLY || 'price_junior_operator_monthly',
    annual: process.env.STRIPE_PRICE_JUNIOR_OPERATOR_ANNUAL || 'price_junior_operator_annual',
    name: 'JUNIOR OPERATOR',
    amount: 2499, // $24.99 (v3 — Junior track ages 8–17, parent-managed)
  },
  junior_opus: {
    monthly: process.env.STRIPE_PRICE_JUNIOR_ELITE_MONTHLY || 'price_junior_elite_monthly',
    annual: process.env.STRIPE_PRICE_JUNIOR_ELITE_ANNUAL || 'price_junior_elite_annual',
    name: 'JUNIOR ELITE',
    amount: 4999, // $49.99 (v3 — competitive youth athletes; capped Opus access)
  },
};

// Free RECON usage caps — see src/lib/usageCaps.ts for enforcement.
export const RECON_CAPS = {
  CHATS_PER_24H: 30,
  WORKOUTS_PER_7D: 5,
} as const;
