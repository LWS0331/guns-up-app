// /api/calendars
//
// GET    — list active calendar connections for the calling operator.
//          Powers the CalendarConnect UI's connected-providers panel.
// DELETE — disconnect a provider. Soft-delete (active=false) so we
//          keep the audit trail of when the connection existed and
//          what scopes it carried. Tokens are zeroed at the same
//          time so a future DB leak doesn't expose a now-revoked
//          credential. Hard-delete only if the operator account
//          itself is being deleted.
//
// Auth: requireAuth — operator manages their OWN connections. Admins
// can use the soft-delete via DELETE with operatorId override only
// if they're in OPS_CENTER_ACCESS.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const requested = url.searchParams.get('operatorId');
  const isAdmin = OPS_CENTER_ACCESS.includes(auth.operatorId);
  const operatorId = requested && isAdmin ? requested : auth.operatorId;

  const connections = await prisma.calendarConnection.findMany({
    where: { operatorId, active: true },
    select: {
      id: true,
      provider: true,
      providerAccountId: true,
      externalCalId: true,
      connectedAt: true,
      lastSyncAt: true,
      scopes: true,
      // Surface lightweight summary fields for the UI without leaking
      // tokens or the full event list (which can be large).
      syncData: true,
    },
  });

  // Project syncData to a small summary so the UI doesn't pull the
  // full event list on every roster render. The events list itself
  // is for Gunny's prompt context, not the UI.
  const summarized = connections.map((c) => {
    const sync = (c.syncData as { eventCount?: number; windowStart?: string; windowEnd?: string } | null) || {};
    return {
      id: c.id,
      provider: c.provider,
      providerAccountId: c.providerAccountId,
      externalCalId: c.externalCalId,
      connectedAt: c.connectedAt,
      lastSyncAt: c.lastSyncAt,
      scopes: c.scopes,
      eventCount: typeof sync.eventCount === 'number' ? sync.eventCount : 0,
      windowStart: sync.windowStart || null,
      windowEnd: sync.windowEnd || null,
    };
  });

  return NextResponse.json({ connections: summarized });
}

export async function DELETE(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: { operatorId?: string; provider?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const isAdmin = OPS_CENTER_ACCESS.includes(auth.operatorId);
  const targetOperatorId =
    body.operatorId && isAdmin ? body.operatorId : auth.operatorId;
  const provider = (body.provider || '').trim();

  if (!provider) {
    return NextResponse.json({ error: 'provider required' }, { status: 400 });
  }

  // Soft-delete + zero tokens. Setting accessTokenEnc/refreshTokenEnc
  // to empty strings (not null — keeps the column shape predictable
  // for any future "list disconnected" admin tool) means a leaked DB
  // row no longer exposes Google credentials.
  const updated = await prisma.calendarConnection.updateMany({
    where: { operatorId: targetOperatorId, provider },
    data: {
      active: false,
      accessTokenEnc: '',
      refreshTokenEnc: '',
      tokenExpiresAt: null,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: 'No active connection for that provider.', code: 'no_connection' },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, disconnected: updated.count });
}
