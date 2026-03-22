import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';

// POST /api/stripe/portal — Create a Stripe Customer Portal session for self-service billing
export async function POST(req: NextRequest) {
  try {
    const { stripeCustomerId } = await req.json();

    if (!stripeCustomerId) {
      return NextResponse.json({ error: 'stripeCustomerId required' }, { status: 400 });
    }

    const stripe = getStripe();
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`;

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: baseUrl,
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
    });
  } catch (error) {
    console.error('Stripe portal error:', error);
    return NextResponse.json(
      { error: 'Failed to create portal session', details: String(error) },
      { status: 500 }
    );
  }
}
