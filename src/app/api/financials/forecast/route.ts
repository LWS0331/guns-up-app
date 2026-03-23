import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { OPS_CENTER_ACCESS, TIER_CONFIGS, AiTier } from '@/lib/types';

// Same auth as /api/financials
function isAuthorized(req: NextRequest): boolean {
  const apiKey = req.headers.get('x-api-key');
  if (apiKey && process.env.GUNS_UP_API_KEY && apiKey === process.env.GUNS_UP_API_KEY) {
    return true;
  }
  const operatorId = req.nextUrl.searchParams.get('operatorId');
  return !!operatorId && OPS_CENTER_ACCESS.includes(operatorId);
}

interface BillingData {
  tier?: string;
  status?: string;
  activatedAt?: string;
  cancelledAt?: string;
}

// GET /api/financials/forecast — project MRR growth for Accountant agent monthly reconciliation
export async function GET(req: NextRequest) {
  const hasAuthAttempt = req.headers.get('x-api-key') || req.nextUrl.searchParams.get('operatorId');
  if (!hasAuthAttempt) {
    return NextResponse.json({ status: 'ok', endpoint: '/api/financials/forecast', auth: 'required', hint: 'Pass x-api-key header or operatorId query param' });
  }
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'ACCESS DENIED' }, { status: 403 });
  }

  try {
    const operators = await prisma.operator.findMany();

    const billingRecords = operators.map(op => {
      const billing = (op.billing as BillingData) || {};
      return {
        tier: (billing.tier || op.tier) as AiTier,
        status: billing.status || 'none',
        activatedAt: billing.activatedAt || null,
        cancelledAt: billing.cancelledAt || null,
      };
    });

    const active = billingRecords.filter(b => b.status === 'active');
    const tiers: AiTier[] = ['haiku', 'sonnet', 'opus', 'white_glove'];

    // Current MRR
    let currentMRR = 0;
    for (const tier of tiers) {
      const count = active.filter(b => b.tier === tier).length;
      currentMRR += count * TIER_CONFIGS[tier].monthlyPrice;
    }
    currentMRR = Math.round(currentMRR * 100) / 100;

    // 30-day growth rate: compare subscribers activated in last 30d vs total
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const newLast30 = active.filter(b => b.activatedAt && new Date(b.activatedAt) >= thirtyDaysAgo).length;
    const activePrev30 = active.filter(b => b.activatedAt && new Date(b.activatedAt) < thirtyDaysAgo).length;

    // Churn in last 30 days
    const churnedLast30 = billingRecords.filter(b =>
      b.status === 'cancelled' && b.cancelledAt && new Date(b.cancelledAt) >= thirtyDaysAgo
    ).length;

    // Churn in previous 30 days (30-60 days ago) for trend
    const churnedPrev30 = billingRecords.filter(b =>
      b.status === 'cancelled' && b.cancelledAt &&
      new Date(b.cancelledAt) >= sixtyDaysAgo && new Date(b.cancelledAt) < thirtyDaysAgo
    ).length;

    // Net growth rate
    const baseCount = activePrev30 > 0 ? activePrev30 : Math.max(active.length - newLast30, 1);
    const netNew = newLast30 - churnedLast30;
    const growthRate30d = Math.round((netNew / baseCount) * 1000) / 1000;

    // Monthly churn rate
    const churnDenom = active.length + churnedLast30;
    const monthlyChurnRate = churnDenom > 0 ? Math.round((churnedLast30 / churnDenom) * 1000) / 1000 : 0;

    // Project forward 3 months (raw growth)
    const projectedMRR = {
      month1: Math.round(currentMRR * (1 + growthRate30d) * 100) / 100,
      month2: Math.round(currentMRR * Math.pow(1 + growthRate30d, 2) * 100) / 100,
      month3: Math.round(currentMRR * Math.pow(1 + growthRate30d, 3) * 100) / 100,
    };

    // Churn-adjusted projection (growth minus expected churn)
    const netGrowth = growthRate30d - monthlyChurnRate;
    const churnAdjusted = {
      month1: Math.round(currentMRR * (1 + netGrowth) * 100) / 100,
      month2: Math.round(currentMRR * Math.pow(1 + netGrowth, 2) * 100) / 100,
      month3: Math.round(currentMRR * Math.pow(1 + netGrowth, 3) * 100) / 100,
    };

    // Break-even target (configurable, default $500)
    const breakEvenTarget = 500.00;
    let monthsToBreakEven: number | null = null;
    if (netGrowth > 0 && currentMRR < breakEvenTarget) {
      // Solve: currentMRR * (1 + netGrowth)^n = breakEvenTarget
      monthsToBreakEven = Math.ceil(Math.log(breakEvenTarget / currentMRR) / Math.log(1 + netGrowth));
    } else if (currentMRR >= breakEvenTarget) {
      monthsToBreakEven = 0;
    }

    // Average revenue per user
    const arpu = active.length > 0 ? Math.round((currentMRR / active.length) * 100) / 100 : 0;

    // Churn trend
    const churnTrend = churnedLast30 > churnedPrev30 ? 'increasing' : churnedLast30 < churnedPrev30 ? 'decreasing' : 'stable';

    return NextResponse.json({
      currentMRR,
      growthRate30d,
      monthlyChurnRate,
      projectedMRR,
      churnAdjusted,
      breakEvenTarget,
      monthsToBreakEven,
      arpu,
      subscriberCount: active.length,
      newLast30d: newLast30,
      churnedLast30d: churnedLast30,
      churnTrend,
      asOf: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Financials forecast error:', error);
    return NextResponse.json({ error: 'Failed to generate forecast' }, { status: 500 });
  }
}
