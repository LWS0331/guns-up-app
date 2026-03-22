import { NextRequest, NextResponse } from 'next/server';
import { getStripe, TIER_PRICES } from '@/lib/stripe';
import { prisma } from '@/lib/db';

// GET /api/stripe/subscription?operatorId=xxx — Get subscription status
export async function GET(req: NextRequest) {
  try {
    const operatorId = req.nextUrl.searchParams.get('operatorId');
    if (!operatorId) {
      return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
    }

    const operator = await prisma.operator.findUnique({ where: { id: operatorId } });
    if (!operator) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }

    const billing = (operator.billing as Record<string, unknown>) || {};
    const subscriptionId = billing.stripeSubscriptionId as string | undefined;

    if (!subscriptionId) {
      return NextResponse.json({
        ok: true,
        subscription: null,
        tier: operator.tier,
        status: 'free',
      });
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);

    return NextResponse.json({
      ok: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        tier: billing.tier || operator.tier,
        currentPeriodEnd: new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
      tier: operator.tier,
    });
  } catch (error) {
    console.error('Subscription check error:', error);
    return NextResponse.json(
      { error: 'Failed to check subscription', details: String(error) },
      { status: 500 }
    );
  }
}

// POST /api/stripe/subscription — Change tier (upgrade/downgrade)
export async function POST(req: NextRequest) {
  try {
    const { operatorId, newTier } = await req.json();

    if (!operatorId || !newTier) {
      return NextResponse.json({ error: 'operatorId and newTier required' }, { status: 400 });
    }

    const tierConfig = TIER_PRICES[newTier];
    if (!tierConfig) {
      return NextResponse.json({ error: `Invalid tier: ${newTier}` }, { status: 400 });
    }

    const operator = await prisma.operator.findUnique({ where: { id: operatorId } });
    if (!operator) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }

    const billing = (operator.billing as Record<string, unknown>) || {};
    const subscriptionId = billing.stripeSubscriptionId as string | undefined;

    if (!subscriptionId) {
      return NextResponse.json({ error: 'No active subscription to modify' }, { status: 400 });
    }

    const stripe = getStripe();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const currentItemId = subscription.items.data[0]?.id;

    if (!currentItemId) {
      return NextResponse.json({ error: 'No subscription item found' }, { status: 400 });
    }

    // Update subscription to new tier price
    const updated = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: currentItemId,
        price: tierConfig.monthly,
      }],
      metadata: { ...subscription.metadata, tier: newTier },
      proration_behavior: 'create_prorations',
    });

    // Update operator tier locally
    await prisma.operator.update({
      where: { id: operatorId },
      data: {
        tier: newTier,
        billing: JSON.parse(JSON.stringify({
          ...billing,
          tier: newTier,
          status: updated.status,
        })),
      },
    });

    return NextResponse.json({
      ok: true,
      newTier,
      subscriptionStatus: updated.status,
    });
  } catch (error) {
    console.error('Subscription update error:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription', details: String(error) },
      { status: 500 }
    );
  }
}
