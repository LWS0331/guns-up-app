import { NextRequest, NextResponse } from 'next/server';
import { getStripe, TIER_PRICES } from '@/lib/stripe';

// POST /api/stripe/checkout — Create a Stripe Checkout session
export async function POST(req: NextRequest) {
  try {
    const { operatorId, tier, billingCycle, email, callsign } = await req.json();

    if (!operatorId || !tier) {
      return NextResponse.json({ error: 'operatorId and tier required' }, { status: 400 });
    }

    const tierConfig = TIER_PRICES[tier];
    if (!tierConfig) {
      return NextResponse.json({ error: `Invalid tier: ${tier}` }, { status: 400 });
    }

    const stripe = getStripe();
    const cycle = billingCycle === 'annual' ? 'annual' : 'monthly';
    const priceId = tierConfig[cycle];

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      metadata: {
        operatorId,
        tier,
        callsign: callsign || '',
        billingCycle: cycle,
      },
      success_url: `${baseUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}?checkout=cancelled`,
      subscription_data: {
        metadata: {
          operatorId,
          tier,
          callsign: callsign || '',
        },
      },
    });

    return NextResponse.json({
      ok: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return NextResponse.json(
      { error: 'Failed to create checkout session', details: String(error) },
      { status: 500 }
    );
  }
}
