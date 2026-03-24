import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { OPS_CENTER_ACCESS, TIER_CONFIGS, AiTier } from '@/lib/types';

// Auth: operatorId query param OR x-api-key header for cross-app access (OVERWATCH)
function isAuthorized(req: NextRequest): boolean {
  // API key auth for cross-app access
  const apiKey = req.headers.get('x-api-key');
  if (apiKey && process.env.GUNS_UP_API_KEY && apiKey === process.env.GUNS_UP_API_KEY) {
    return true;
  }
  // Operator auth (same pattern as /api/ops)
  const operatorId = req.nextUrl.searchParams.get('operatorId');
  return !!operatorId && OPS_CENTER_ACCESS.includes(operatorId);
}

interface BillingData {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  tier?: string;
  status?: string;
  activatedAt?: string;
  currentPeriodEnd?: string;
  cancelledAt?: string;
  lastPaymentFailed?: string;
}

// GET /api/financials — aggregate subscription/revenue data for Accountant agent
export async function GET(req: NextRequest) {
  // Health check: no auth params = return status only (no financial data)
  const hasAuthAttempt = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('operatorId');
  if (!hasAuthAttempt) {
    return NextResponse.json({ status: 'ok', endpoint: '/api/financials', auth: 'required', hint: 'Pass x-api-key header or operatorId query param' });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'ACCESS DENIED' }, { status: 403 });
  }

  try {
    // Only fetch the fields we need — not entire operator records with workouts/profiles/etc.
    const operators = await prisma.operator.findMany({
      select: { id: true, callsign: true, tier: true, billing: true },
    });

    // Parse billing data from each operator
    const billingRecords = operators.map(op => {
      const billing = (op.billing as BillingData) || {};
      return {
        operatorId: op.id,
        callsign: op.callsign,
        tier: (billing.tier || op.tier) as AiTier,
        status: billing.status || 'none',
        activatedAt: billing.activatedAt || null,
        currentPeriodEnd: billing.currentPeriodEnd || null,
        cancelledAt: billing.cancelledAt || null,
        lastPaymentFailed: billing.lastPaymentFailed || null,
      };
    });

    // Active subscribers
    const active = billingRecords.filter(b => b.status === 'active');
    const pastDue = billingRecords.filter(b => b.status === 'past_due');

    // Group by tier and calculate revenue
    const tiers: AiTier[] = ['haiku', 'sonnet', 'opus', 'white_glove'];
    const subscribersByTier: Record<string, { count: number; revenue: number }> = {};
    let mrr = 0;

    for (const tier of tiers) {
      const tierActive = active.filter(b => b.tier === tier);
      const price = TIER_CONFIGS[tier].monthlyPrice;
      const revenue = tierActive.length * price;
      subscribersByTier[tier] = { count: tierActive.length, revenue: Math.round(revenue * 100) / 100 };
      mrr += revenue;
    }

    // Churn: cancelled in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentChurn = billingRecords.filter(b => {
      if (b.status !== 'cancelled' || !b.cancelledAt) return false;
      return new Date(b.cancelledAt) >= thirtyDaysAgo;
    });

    // Churn rate = churned / (active + churned) over 30 days
    const churnDenom = active.length + recentChurn.length;
    const churnRate = churnDenom > 0 ? Math.round((recentChurn.length / churnDenom) * 1000) / 1000 : 0;

    // Failed payments
    const failedPayments = billingRecords
      .filter(b => b.lastPaymentFailed)
      .map(b => ({
        operatorId: b.operatorId,
        callsign: b.callsign,
        tier: b.tier,
        failedAt: b.lastPaymentFailed,
      }));

    // API cost estimates from tier configs
    const apiCostsByTier: Record<string, number> = {};
    let totalApiCost = 0;
    for (const tier of tiers) {
      const count = subscribersByTier[tier].count;
      const cost = Math.round(count * TIER_CONFIGS[tier].apiCostEstimate * 100) / 100;
      apiCostsByTier[tier] = cost;
      totalApiCost += cost;
    }

    const netRevenue = Math.round((mrr - totalApiCost) * 100) / 100;

    return NextResponse.json({
      mrr: Math.round(mrr * 100) / 100,
      subscribersByTier,
      totalActive: active.length,
      totalPastDue: pastDue.length,
      churn30d: { count: recentChurn.length, rate: churnRate },
      failedPayments,
      apiCosts: {
        estimatedMonthly: Math.round(totalApiCost * 100) / 100,
        byTier: apiCostsByTier,
      },
      netRevenue,
      totalOperators: operators.length,
      asOf: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Financials error:', error);
    return NextResponse.json({ error: 'Failed to fetch financial data' }, { status: 500 });
  }
}
