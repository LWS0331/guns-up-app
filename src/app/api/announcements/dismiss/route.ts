// POST /api/announcements/dismiss
//
// Marks an announcement as seen for the calling operator. The next
// /api/announcements/current call will skip everything up to and
// including this id and return whatever's newer (usually nothing).
//
// Body: { announcementId: string }
//
// Auth: requireAuth via the standard JWT.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const announcementId: string | undefined = body?.announcementId;
    if (!announcementId || typeof announcementId !== 'string') {
      return NextResponse.json({
        error: 'announcementId required',
      }, { status: 400 });
    }

    const op = await prisma.operator.findUnique({
      where: { id: auth.operatorId },
      select: { preferences: true },
    });
    if (!op) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }

    const prefs = (op.preferences || {}) as Record<string, unknown>;
    const updated = {
      ...prefs,
      lastSeenAnnouncementId: announcementId,
      lastSeenAnnouncementAt: new Date().toISOString(),
    };

    await prisma.operator.update({
      where: { id: auth.operatorId },
      data: { preferences: updated as object },
    });

    return NextResponse.json({ ok: true, lastSeenAnnouncementId: announcementId });
  } catch (err) {
    console.error('[announcements/dismiss]', err);
    return NextResponse.json({
      error: 'Failed to dismiss announcement',
      details: String(err),
    }, { status: 500 });
  }
}
