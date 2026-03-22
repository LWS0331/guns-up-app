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

// Tier → Stripe Price mapping (set these in Railway env vars)
export const TIER_PRICES: Record<string, { monthly: string; annual: string; name: string; amount: number }> = {
  haiku: {
    monthly: process.env.STRIPE_PRICE_RECON_MONTHLY || 'price_recon_monthly',
    annual: process.env.STRIPE_PRICE_RECON_ANNUAL || 'price_recon_annual',
    name: 'RECON',
    amount: 200, // $2.00
  },
  sonnet: {
    monthly: process.env.STRIPE_PRICE_OPERATOR_MONTHLY || 'price_operator_monthly',
    annual: process.env.STRIPE_PRICE_OPERATOR_ANNUAL || 'price_operator_annual',
    name: 'OPERATOR',
    amount: 500, // $5.00
  },
  opus: {
    monthly: process.env.STRIPE_PRICE_COMMANDER_MONTHLY || 'price_commander_monthly',
    annual: process.env.STRIPE_PRICE_COMMANDER_ANNUAL || 'price_commander_annual',
    name: 'COMMANDER',
    amount: 1500, // $15.00
  },
  white_glove: {
    monthly: process.env.STRIPE_PRICE_WARFIGHTER_MONTHLY || 'price_warfighter_monthly',
    annual: process.env.STRIPE_PRICE_WARFIGHTER_ANNUAL || 'price_warfighter_annual',
    name: 'WARFIGHTER',
    amount: 4999, // $49.99
  },
};
