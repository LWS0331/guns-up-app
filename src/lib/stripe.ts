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
// Pricing Strategy v2 (April 2026 — supersedes v1):
//   - RECON is now FREE with hard usage caps (30 chats/24h, 5 workout
//     gens/7d). No Stripe Price IDs for RECON — it's $0/mo.
//   - OPERATOR holds at $9.99/mo (Apple IAP or Stripe).
//   - COMMANDER holds at $14.99/mo (Stripe web only — protects
//     trainer revenue share moat).
//   - WARFIGHTER at $49.99/mo for Phase 1 (Stripe web only). Phase 2
//     lift to $79.99 in Q4 of Year One — calendar-gated, not yet.
//
// `amount` is the monthly price in cents — kept in sync with the canonical
// pricing on /app/landing/page.tsx and the in-app TIER_OFFERS array in
// src/components/BillingPanel.tsx. Update all three when prices change.
export const TIER_PRICES: Record<string, { monthly: string; annual: string; name: string; amount: number; free?: boolean }> = {
  haiku: {
    // RECON is FREE. Stripe Price IDs retained as fallbacks only — should
    // never be charged in v2 since the checkout endpoint refuses to create
    // a session for `tier=haiku`. If we ever wire a "RECON Plus" paid SKU
    // these env vars become live again.
    monthly: process.env.STRIPE_PRICE_RECON_MONTHLY || 'price_recon_monthly',
    annual: process.env.STRIPE_PRICE_RECON_ANNUAL || 'price_recon_annual',
    name: 'RECON',
    amount: 0,           // $0 — free with caps
    free: true,
  },
  sonnet: {
    monthly: process.env.STRIPE_PRICE_OPERATOR_MONTHLY || 'price_operator_monthly',
    annual: process.env.STRIPE_PRICE_OPERATOR_ANNUAL || 'price_operator_annual',
    name: 'OPERATOR',
    amount: 999, // $9.99
  },
  opus: {
    monthly: process.env.STRIPE_PRICE_COMMANDER_MONTHLY || 'price_commander_monthly',
    annual: process.env.STRIPE_PRICE_COMMANDER_ANNUAL || 'price_commander_annual',
    name: 'COMMANDER',
    amount: 1499, // $14.99
  },
  white_glove: {
    monthly: process.env.STRIPE_PRICE_WARFIGHTER_MONTHLY || 'price_warfighter_monthly',
    annual: process.env.STRIPE_PRICE_WARFIGHTER_ANNUAL || 'price_warfighter_annual',
    name: 'WARFIGHTER',
    amount: 4999, // $49.99 (Phase 1; Phase 2 lift to $79.99 deferred to Q4)
  },
};

// Free RECON usage caps — see src/lib/usageCaps.ts for enforcement.
export const RECON_CAPS = {
  CHATS_PER_24H: 30,
  WORKOUTS_PER_7D: 5,
} as const;
