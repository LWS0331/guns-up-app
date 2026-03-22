import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { prisma } from '@/lib/db';
import Stripe from 'stripe';

// POST /api/stripe/webhook — Handle Stripe webhook events
export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Missing signature or webhook secret' }, { status: 400 });
    }

    const stripe = getStripe();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const operatorId = session.metadata?.operatorId;
        const tier = session.metadata?.tier;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (operatorId && tier) {
          // Update operator with Stripe customer + subscription info
          const operator = await prisma.operator.findUnique({ where: { id: operatorId } });
          if (operator) {
            const billing = {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              tier,
              status: 'active',
              activatedAt: new Date().toISOString(),
            };
            await prisma.operator.update({
              where: { id: operatorId },
              data: {
                tier,
                billing: JSON.parse(JSON.stringify(billing)),
              },
            });
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const operatorId = subscription.metadata?.operatorId;
        const status = subscription.status;

        if (operatorId) {
          const operator = await prisma.operator.findUnique({ where: { id: operatorId } });
          if (operator) {
            const existingBilling = (operator.billing as Record<string, unknown>) || {};
            await prisma.operator.update({
              where: { id: operatorId },
              data: {
                billing: JSON.parse(JSON.stringify({
                  ...existingBilling,
                  status,
                  currentPeriodEnd: new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000).toISOString(),
                })),
              },
            });
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const operatorId = subscription.metadata?.operatorId;

        if (operatorId) {
          const operator = await prisma.operator.findUnique({ where: { id: operatorId } });
          if (operator) {
            const existingBilling = (operator.billing as Record<string, unknown>) || {};
            await prisma.operator.update({
              where: { id: operatorId },
              data: {
                tier: 'haiku', // Downgrade to free tier
                billing: JSON.parse(JSON.stringify({
                  ...existingBilling,
                  status: 'cancelled',
                  cancelledAt: new Date().toISOString(),
                })),
              },
            });
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = (invoice as unknown as { subscription: string }).subscription;

        if (subscriptionId) {
          // Find operator by subscription ID
          const operators = await prisma.operator.findMany();
          const op = operators.find(o => {
            const billing = o.billing as Record<string, unknown> | null;
            return billing?.stripeSubscriptionId === subscriptionId;
          });

          if (op) {
            const existingBilling = (op.billing as Record<string, unknown>) || {};
            await prisma.operator.update({
              where: { id: op.id },
              data: {
                billing: JSON.parse(JSON.stringify({
                  ...existingBilling,
                  status: 'past_due',
                  lastPaymentFailed: new Date().toISOString(),
                })),
              },
            });
          }
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: String(error) },
      { status: 500 }
    );
  }
}
