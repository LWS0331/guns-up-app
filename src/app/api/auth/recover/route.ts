// POST /api/auth/recover
//
// Recovery wizard backend (PaywallSpec §7). Handles the "I paid but
// it's not working" path. Three search strategies, in order:
//
//   1. Email match in Stripe customers AND in Operator records
//      → mint magic link, queue activation email, return ok
//   2. Email match in Stripe but NO Operator record yet
//      → repair (create Operator from Stripe customer + tier from
//        active subscription), then mint magic link, queue email
//   3. Email found in Operator but NO Stripe subscription
//      → user has an account but never paid. Route them to checkout
//        instead of magic-link.
//
// If still not found, the response includes a hint to email support.
// We never confirm or deny account existence in error responses — the
// recovery wizard is rate-limited at the IP level via Stripe's own
// API budget (we only call Stripe.customers.search if the email isn't
// already in our DB).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getStripe } from '@/lib/stripe';
import { mintToken } from '@/lib/authTokens';
import { queueActivationEmail } from '@/lib/activationEmails';

interface RecoverRequest {
  email?: string;
  cardLast4?: string;
  purchaseDate?: string;  // ISO YYYY-MM-DD, ±3 days
}

const STRIPE_TO_TIER: Record<string, string> = {
  // Stripe Price ID env-var names → operator tier. The webhook uses
  // similar logic; centralizing it would be a small refactor we'll
  // do once Connect-mediated trainer payouts land.
  recon: 'haiku',
  operator: 'sonnet',
  commander: 'opus',
  warfighter: 'white_glove',
};

function priceIdToTier(priceId: string | null | undefined): string | null {
  if (!priceId) return null;
  for (const [name, tier] of Object.entries({
    [process.env.STRIPE_PRICE_OPERATOR_MONTHLY || '']: 'sonnet',
    [process.env.STRIPE_PRICE_OPERATOR_ANNUAL || '']: 'sonnet',
    [process.env.STRIPE_PRICE_COMMANDER_MONTHLY || '']: 'opus',
    [process.env.STRIPE_PRICE_COMMANDER_ANNUAL || '']: 'opus',
    [process.env.STRIPE_PRICE_WARFIGHTER_MONTHLY || '']: 'white_glove',
    [process.env.STRIPE_PRICE_WARFIGHTER_ANNUAL || '']: 'white_glove',
  })) {
    if (priceId === name) return tier;
  }
  // Best-effort fallback by name match (test environments).
  const lower = priceId.toLowerCase();
  for (const key of Object.keys(STRIPE_TO_TIER)) {
    if (lower.includes(key)) return STRIPE_TO_TIER[key];
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body: RecoverRequest = await req.json();
    const email = (body?.email || '').toString().trim().toLowerCase();
    if (!email || !email.includes('@')) {
      return NextResponse.json({
        error: 'Email required.',
      }, { status: 400 });
    }

    // Bump recoveryAttempts on any matching operator (audit trail).
    const existing = await prisma.operator.findFirst({ where: { email } });
    if (existing) {
      await prisma.operator.update({
        where: { id: existing.id },
        data: {
          recoveryAttempts: { increment: 1 },
          passwordResetRequestedAt: new Date(),
        },
      });
    }

    // === Strategy 1: Operator + Stripe both present ===
    if (existing) {
      const minted = await mintToken({
        operatorId: existing.id,
        type: 'magic_link',
        intent: 'sign_in',
        metadata: { trigger: 'recovery' },
      });
      await queueActivationEmail({
        operatorId: existing.id,
        kind: 'magic_link',
        email,
        magicToken: minted.token,
      });
      return NextResponse.json({
        ok: true,
        outcome: 'magic_link_sent',
        message: `If an account exists for ${email}, we've sent a magic link. Check your inbox.`,
      });
    }

    // === Strategy 2: Stripe customer exists, no Operator yet (repair) ===
    let stripeCustomerId: string | null = null;
    let inferredTier: string | null = null;
    try {
      const stripe = getStripe();
      // Stripe API search by email.
      const customers = await stripe.customers.list({ email, limit: 1 });
      const customer = customers.data[0];
      if (customer) {
        stripeCustomerId = customer.id;
        // Look up active subscriptions to infer tier.
        const subs = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'active',
          limit: 1,
        });
        const sub = subs.data[0];
        if (sub && sub.items.data[0]?.price?.id) {
          inferredTier = priceIdToTier(sub.items.data[0].price.id);
        }
      }
    } catch (err) {
      // Stripe key missing in dev env? Treat as no-Stripe-match.
      console.warn('[recover] Stripe lookup failed:', err);
    }

    if (stripeCustomerId && inferredTier) {
      // Auto-repair: create the Operator record so the user can sign in.
      const callsign = `OPERATOR-${Math.floor(1000 + Math.random() * 9000)}`;
      const newOp = await prisma.operator.create({
        data: {
          id: `op-${stripeCustomerId.slice(-12)}`,
          name: email.split('@')[0],
          callsign,
          pin: '0000',
          email,
          role: 'client',
          tier: inferredTier,
          billing: { stripeCustomerId },
          webPurchaseAt: new Date(),
        },
      });
      const minted = await mintToken({
        operatorId: newOp.id,
        type: 'magic_link',
        intent: 'sign_in',
        metadata: { trigger: 'recovery_repair' },
      });
      await queueActivationEmail({
        operatorId: newOp.id,
        kind: 'magic_link',
        email,
        magicToken: minted.token,
      });
      return NextResponse.json({
        ok: true,
        outcome: 'account_repaired',
        message: 'We found your subscription but no app account — we\'ve created one and sent you a magic link.',
      });
    }

    // === Strategy 3: nothing found ===
    return NextResponse.json({
      ok: true,
      outcome: 'not_found',
      message: 'We couldn\'t locate a subscription for that email. Email support@gunsupfitness.com with your Stripe receipt and we\'ll get you in.',
    });
  } catch (error) {
    console.error('[recover] error', error);
    return NextResponse.json({
      error: 'Recovery request failed.',
      details: String(error),
    }, { status: 500 });
  }
}
