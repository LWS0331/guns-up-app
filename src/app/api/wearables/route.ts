import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTrainerAuth } from '@/lib/requireTrainerAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';

// GET /api/wearables?operatorId=xxx — List connected wearables for an operator.
//
// Auth model: self / admin / trainer-of-target. Previously this route had
// NO access check on GET — any authenticated caller could request any
// operator's wearable connections. Tightened here as part of the Phase 3c
// MCP rollout so trainer-of-target is explicit and non-clients still 403.
export async function GET(req: NextRequest) {
  const auth = requireTrainerAuth(req);
  if (auth instanceof NextResponse) return auth;
  const operatorId = req.nextUrl.searchParams.get('operatorId');

  if (!operatorId) {
    return NextResponse.json({ error: 'operatorId query param required' }, { status: 400 });
  }

  const isSelf = auth.operatorId === operatorId;
  const isAdmin = OPS_CENTER_ACCESS.includes(auth.operatorId);
  let isTrainerOfTarget = false;
  if (!isSelf && !isAdmin) {
    const target = await prisma.operator.findUnique({
      where: { id: operatorId },
      select: { trainerId: true },
    });
    isTrainerOfTarget = !!target && target.trainerId === auth.operatorId;
  }
  if (!isSelf && !isAdmin && !isTrainerOfTarget) {
    return NextResponse.json(
      { error: 'Forbidden: cannot read wearables for another operator' },
      { status: 403 }
    );
  }

  try {
    const connections = await prisma.wearableConnection.findMany({
      where: { operatorId, active: true },
      orderBy: { connectedAt: 'desc' },
    });

    return NextResponse.json({ connections });
  } catch (error) {
    console.error('Error fetching wearable connections:', error);
    return NextResponse.json({ connections: [] });
  }
}

// DELETE /api/wearables — Disconnect a wearable
export async function DELETE(req: NextRequest) {
  try {
    const { operatorId, provider } = await req.json();

    if (!operatorId || !provider) {
      return NextResponse.json({ error: 'operatorId and provider required' }, { status: 400 });
    }

    await prisma.wearableConnection.updateMany({
      where: { operatorId, provider },
      data: { active: false },
    });

    return NextResponse.json({ ok: true, message: `Disconnected ${provider}` });
  } catch (error) {
    console.error('Error disconnecting wearable:', error);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
