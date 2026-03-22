import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { OPS_CENTER_ACCESS } from '@/lib/types';

// POST /api/ops/reset — Reset all operator accounts to blank slate (except excluded IDs)
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { operatorId, excludeIds } = body;

    if (!operatorId || !OPS_CENTER_ACCESS.includes(operatorId)) {
      return NextResponse.json({ error: 'ACCESS DENIED' }, { status: 403 });
    }

    const exclude = excludeIds || ['op-ruben'];

    // Reset all operators except excluded
    const allOps = await prisma.operator.findMany();
    const toReset = allOps.filter(op => !exclude.includes(op.id));

    let resetCount = 0;
    for (const op of toReset) {
      await prisma.operator.update({
        where: { id: op.id },
        data: {
          profile: {},
          nutrition: { targets: { calories: 0, protein: 0, carbs: 0, fat: 0 }, meals: {} },
          prs: [],
          injuries: [],
          workouts: {},
          dayTags: {},
          preferences: {},
          betaFeedback: [],
        },
      });
      resetCount++;
    }

    // Clear all chat histories for reset operators
    const resetIds = toReset.map(op => op.id);
    const deletedChats = await prisma.chatHistory.deleteMany({
      where: { operatorId: { in: resetIds } },
    });

    return NextResponse.json({
      success: true,
      resetCount,
      chatsCleared: deletedChats.count,
      excluded: exclude,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json({ error: 'Reset failed' }, { status: 500 });
  }
}
