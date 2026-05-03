import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { OPS_CENTER_ACCESS } from '@/lib/types';

// GET /api/ops?operatorId=op-ruben — real platform metrics from DB
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const operatorId = searchParams.get('operatorId');

    // Verify access
    if (!operatorId || !OPS_CENTER_ACCESS.includes(operatorId)) {
      return NextResponse.json({ error: 'ACCESS DENIED' }, { status: 403 });
    }

    // ═══════════════════════════════════════
    // REAL DB QUERIES — all in parallel
    // ═══════════════════════════════════════
    const [
      operators,
      chatHistories,
      wearableConnections,
    ] = await Promise.all([
      prisma.operator.findMany(),
      prisma.chatHistory.findMany(),
      prisma.$queryRawUnsafe<Array<{ count: string }>>(
        `SELECT COUNT(*) as count FROM "WearableConnection" WHERE active = true`
      ).catch(() => [{ count: '0' }]),
    ]);

    // ═══════════════════════════════════════
    // OPERATOR ANALYTICS
    // ═══════════════════════════════════════
    const trainers = operators.filter(op => op.role === 'trainer');
    const clients = operators.filter(op => op.role === 'client');
    const betaUsers = operators.filter(op => op.betaUser);

    // Parse JSONB fields safely
    const operatorStats = operators.map(op => {
      const workouts = (op.workouts as Record<string, unknown>) || {};
      const prs = (op.prs as unknown[]) || [];
      const injuries = (op.injuries as unknown[]) || [];
      const profile = (op.profile as Record<string, unknown>) || {};
      const preferences = (op.preferences as Record<string, unknown>) || {};
      const nutrition = (op.nutrition as Record<string, unknown>) || {};
      const meals = (nutrition.meals as Record<string, unknown[]>) || {};
      // Stripe billing status — used by OpsCenter Revenue tab to gate
      // PAID/MRR math. Only `billing.status === 'active'` counts as
      // generating revenue. During closed beta this is universally
      // empty; it lights up the moment a Stripe webhook flips status.
      const billing = (op.billing as Record<string, unknown>) || {};
      const billingStatus = typeof billing.status === 'string' ? billing.status : null;

      const workoutDates = Object.keys(workouts);
      const workoutCount = workoutDates.length;
      const mealCount = Object.values(meals).reduce((sum, dayMeals) =>
        sum + (Array.isArray(dayMeals) ? dayMeals.length : 0), 0);

      // Active = has workout in last 7 days
      let isActive = false;
      if (workoutDates.length > 0) {
        const latestDate = workoutDates.sort().reverse()[0];
        const daysSince = (Date.now() - new Date(latestDate).getTime()) / (1000 * 60 * 60 * 24);
        isActive = daysSince <= 7;
      }

      // Profile completeness check
      const hasProfile = !!(profile.age && profile.weight && profile.goals &&
        (profile.goals as string[]).length > 0 && preferences.daysPerWeek);

      return {
        id: op.id,
        callsign: op.callsign,
        name: op.name,
        role: op.role,
        tier: op.tier,
        // Closed-beta visibility fields — added so OpsCenter roster can
        // render the full operator state (allowlist activated? google
        // linked? vanguard? tier locked?) directly from /api/ops without
        // falling back to the stale `operators` prop.
        email: op.email,
        googleId: op.googleId,
        tierLocked: op.tierLocked,
        isVanguard: op.isVanguard,
        promoActive: op.promoActive,
        trainerId: op.trainerId,
        betaUser: op.betaUser,
        billingStatus,
        workoutCount,
        mealCount,
        prCount: prs.length,
        injuryCount: injuries.length,
        isActive,
        hasProfile,
        createdAt: op.createdAt,
        updatedAt: op.updatedAt,
      };
    });

    // ═══════════════════════════════════════
    // CHAT / AI USAGE ANALYTICS
    // ═══════════════════════════════════════
    let totalMessages = 0;
    let totalGunnyChats = 0;
    let totalOnboardingChats = 0;
    let totalPanelChats = 0;

    const chatsByOperator: Record<string, number> = {};

    chatHistories.forEach(chat => {
      const messages = (chat.messages as unknown[]) || [];
      const msgCount = messages.length;
      totalMessages += msgCount;

      // Track per-operator message counts
      chatsByOperator[chat.operatorId] = (chatsByOperator[chat.operatorId] || 0) + msgCount;

      if (chat.chatType === 'gunny-tab') totalGunnyChats++;
      if (chat.chatType === 'gunny-onboarding') totalOnboardingChats++;
      if (chat.chatType === 'gunny-panel') totalPanelChats++;
    });

    // Estimate tokens from message count (avg ~500 tokens per message exchange)
    const estTotalTokens = totalMessages * 500;

    // ═══════════════════════════════════════
    // AGGREGATE METRICS
    // ═══════════════════════════════════════
    const totalWorkouts = operatorStats.reduce((sum, op) => sum + op.workoutCount, 0);
    const totalMeals = operatorStats.reduce((sum, op) => sum + op.mealCount, 0);
    const totalPRs = operatorStats.reduce((sum, op) => sum + op.prCount, 0);
    const totalInjuries = operatorStats.reduce((sum, op) => sum + op.injuryCount, 0);
    const activeCount = operatorStats.filter(op => op.isActive).length;
    const profileCompleteCount = operatorStats.filter(op => op.hasProfile).length;
    const activeWearables = parseInt(wearableConnections[0]?.count || '0');

    // ═══════════════════════════════════════
    // RESPONSE
    // ═══════════════════════════════════════
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      operators: {
        total: operators.length,
        trainers: trainers.length,
        clients: clients.length,
        beta: betaUsers.length,
        active7d: activeCount,
        profileComplete: profileCompleteCount,
        operatorStats, // detailed per-operator data
      },
      platform: {
        totalWorkouts,
        totalMeals,
        totalPRs,
        totalInjuries,
        activeWearables,
      },
      chatsByOperator,
      ai: {
        totalChatSessions: chatHistories.length,
        totalMessages,
        gunnyChatSessions: totalGunnyChats,
        onboardingSessions: totalOnboardingChats,
        panelSessions: totalPanelChats,
        estTotalTokens,
        estMonthlyCostUSD: (estTotalTokens / 1000000) * 3, // ~$3/MTok blended
      },
      db: {
        operatorRows: operators.length,
        chatRows: chatHistories.length,
        estTotalRows: operators.length + chatHistories.length,
      },
    });
  } catch (error) {
    console.error('OPS metrics error:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
