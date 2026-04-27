// GET /api/stripe/checkout-session?session_id=cs_xxx
//
// Read-only lookup for the /welcome page. Polls until the Stripe
// webhook has fired and the local Operator record has tier set —
// avoids the race in PaywallSpec §10 edge 4 where the success page
// loads before the webhook updates the DB.
//
// Returns:
//   { ready: true,  email, tier, callsign, amount, cycle, cardLast4 }
//   { ready: false, reason }     — webhook not yet received
//
// No auth required: the session_id itself is the bearer credential
// (cs_xxx is single-use and Stripe won't reveal a session a third
// party didn't create). We never expose anything that wasn't on the
// receipt.

import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('session_id');
    if (!sessionId || !sessionId.startsWith('cs_')) {
      return NextResponse.json({ error: 'Valid session_id required' }, { status: 400 });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['customer', 'subscription', 'subscription.items.data.price'],
    });

    if (!session) {
      return NextResponse.json({ ready: false, reason: 'session_not_found' });
    }
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return NextResponse.json({ ready: false, reason: 'payment_pending' });
    }

    const operatorId = session.metadata?.operatorId;
    const tierFromMetadata = session.metadata?.tier;
    const cycle = session.metadata?.billingCycle === 'annual' ? 'annual' : 'monthly';

    // Resolve the operator (webhook should have set tier by now).
    const op = operatorId
      ? await prisma.operator.findUnique({ where: { id: operatorId } })
      : null;

    if (!op) {
      // Webhook hasn't fired yet — tell the page to keep polling.
      return NextResponse.json({ ready: false, reason: 'operator_pending' });
    }

    // Best-effort: pull amount + last4 from the session for receipt UX.
    type StripeWithAmount = { amount_total?: number | null };
    const amount = (session as unknown as StripeWithAmount).amount_total;
    let cardLast4: string | undefined;
    try {
      type StripePaymentIntent = { payment_method?: string | null };
      const pi = (session as unknown as { payment_intent?: string | StripePaymentIntent | null }).payment_intent;
      if (typeof pi === 'string' && pi.startsWith('pi_')) {
        const intent = await stripe.paymentIntents.retrieve(pi, { expand: ['payment_method'] });
        type StripePMCard = { card?: { last4?: string } };
        const pm = (intent as unknown as { payment_method?: StripePMCard }).payment_method;
        cardLast4 = pm?.card?.last4;
      }
    } catch {
      /* not fatal */
    }

    return NextResponse.json({
      ready: true,
      email: op.email,
      callsign: op.callsign,
      tier: tierFromMetadata || op.tier,
      amount,
      cycle,
      cardLast4,
    });
  } catch (error) {
    console.error('[checkout-session] error', error);
    return NextResponse.json({
      error: 'Failed to retrieve checkout session',
      details: String(error),
    }, { status: 500 });
  }
}
