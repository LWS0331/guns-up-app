import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';

// POST /api/ops/reset — Reset all operator accounts to blank slate (except excluded IDs)
// AUTH: caller must be authenticated AND in OPS_CENTER_ACCESS.
// Previously trusted operatorId from the request body with no auth, which let an
// unauthenticated attacker wipe every operator's data by POSTing any admin's id.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!OPS_CENTER_ACCESS.includes(auth.operatorId)) {
    return NextResponse.json({ error: 'ACCESS DENIED' }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const excludeIds: string[] = Array.isArray(body?.excludeIds) ? body.excludeIds : ['op-ruben'];

    const allOps = await prisma.operator.findMany();
    const toReset = allOps.filter(op => !excludeIds.includes(op.id));

    let resetCount = 0;
    for (const op of toReset) {
      await prisma.operator.update({
        where: { id: op.id },
        data: {
          intake: {},
          profile: {},
          nutrition: { targets: { calories: 0, protein: 0, carbs: 0, fat: 0 }, meals: {} },
          prs: [],
          injuries: [],
          workouts: {},
          dayTags: {},
          preferences: {},
          sitrep: {},
          dailyBrief: {},
          betaFeedback: [],
        },
      });
      resetCount++;
    }

    const resetIds = toReset.map(op => op.id);
    const deletedChats = await prisma.chatHistory.deleteMany({
      where: { operatorId: { in: resetIds } },
    });

    console.warn('[api/ops/reset] executed', { actor: auth.operatorId, resetCount, excluded: excludeIds });

    return NextResponse.json({
      success: true,
      resetCount,
      chatsCleared: deletedChats.count,
      excluded: excludeIds,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
