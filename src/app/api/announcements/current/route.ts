// GET /api/announcements/current
//
// Returns the most recent What's New entry the operator hasn't dismissed,
// or `{ announcement: null }` if they're caught up. AppShell calls this
// once on app load and renders WhatsNewModal when an entry comes back.
//
// Storage: operator.preferences.lastSeenAnnouncementId — JSON column,
// no schema migration needed.
//
// Auth: requireAuth via the standard JWT. Returns 401 if not signed in.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { getNextUnseenAnnouncement } from '@/data/announcements';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const op = await prisma.operator.findUnique({
      where: { id: auth.operatorId },
      select: { preferences: true },
    });
    if (!op) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }

    const prefs = (op.preferences || {}) as Record<string, unknown>;
    const lastSeen = typeof prefs.lastSeenAnnouncementId === 'string'
      ? prefs.lastSeenAnnouncementId
      : undefined;

    const announcement = getNextUnseenAnnouncement(lastSeen);

    return NextResponse.json({ announcement });
  } catch (err) {
    console.error('[announcements/current]', err);
    return NextResponse.json({
      error: 'Failed to load announcement',
      details: String(err),
    }, { status: 500 });
  }
}
