import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';

// GET /api/wearables?operatorId=xxx — List connected wearables for an operator
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  const operatorId = req.nextUrl.searchParams.get('operatorId');

  if (!operatorId) {
    return NextResponse.json({ error: 'operatorId query param required' }, { status: 400 });
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
