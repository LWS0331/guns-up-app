import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/admin/reset — wipe all user-generated data, preserve identity/auth
// Requires ADMIN_SECRET header or query param
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret') || new URL(req.url).searchParams.get('secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Reset all operator data fields to defaults (preserve identity, auth, roles, beta config)
    const result = await prisma.operator.updateMany({
      data: {
        intake: {},
        profile: {},
        nutrition: {},
        prs: [],
        injuries: [],
        preferences: {},
        workouts: {},
        dayTags: {},
        sitrep: {},
        dailyBrief: {},
      },
    });

    // Clear all chat history
    const chats = await prisma.chatHistory.deleteMany({});

    return NextResponse.json({
      ok: true,
      operatorsReset: result.count,
      chatsCleared: chats.count,
      preserved: ['id', 'name', 'callsign', 'pin', 'email', 'passwordHash', 'role', 'tier', 'trainerId', 'clientIds', 'betaUser', 'isVanguard'],
      wiped: ['intake', 'profile', 'nutrition', 'prs', 'injuries', 'preferences', 'workouts', 'dayTags', 'sitrep', 'dailyBrief', 'chatHistory'],
    });
  } catch (error) {
    console.error('Reset error:', error);
    return NextResponse.json({ error: 'Reset failed', details: String(error) }, { status: 500 });
  }
}
