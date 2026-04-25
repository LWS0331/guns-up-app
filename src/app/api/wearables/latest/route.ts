import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';

// GET /api/wearables/latest?operatorId=xxx
//
// Read-only "what's the freshest snapshot we have?" endpoint. Designed to
// be polled at high frequency (e.g., every 10–30s during an active
// workout) without thrashing Vital's API.
//
// Why this exists separately from /api/wearables/sync: the sync route
// triggers a live Vital fetch, writes to the DB, and updates the
// operator's profile. Calling that on a 10s poll spams Vital and
// generates write contention. The Planner used to call sync directly
// during workoutMode — this endpoint replaces that with a cheap
// read of the most recent cached syncData blob.
//
// Cadence model: a single sync runs at workout start (one POST to
// /api/wearables/sync) to refresh the cache, then polling hits this
// endpoint. If the wearable webhook (also separately wired) fires
// new HR data, syncData updates and the next poll picks it up.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const operatorId = req.nextUrl.searchParams.get('operatorId');
  if (!operatorId) {
    return NextResponse.json({ error: 'operatorId query param required' }, { status: 400 });
  }

  // Same auth model as the sync route: own-or-admin. A trainer reading
  // a client's HR isn't blocked here yet — that's the next iteration.
  const isSelf = auth.operatorId === operatorId;
  const isAdmin = OPS_CENTER_ACCESS.includes(auth.operatorId);
  if (!isSelf && !isAdmin) {
    return NextResponse.json(
      { error: 'Forbidden: cannot read wearables for another operator' },
      { status: 403 }
    );
  }

  try {
    // Most-recently-synced active connection wins. If the user has both
    // a watch and a chest strap connected, whichever pushed data last
    // is the one we trust for the live HR read.
    const conn = await prisma.wearableConnection.findFirst({
      where: { operatorId, active: true },
      orderBy: { lastSyncAt: 'desc' },
    });

    if (!conn || !conn.syncData) {
      return NextResponse.json({
        ok: true,
        connected: !!conn,
        snapshot: null,
        currentHR: null,
        lastSyncAt: conn?.lastSyncAt ?? null,
      });
    }

    const sync = conn.syncData as Record<string, unknown>;
    const activity = (sync?.activity as Record<string, unknown>) || null;

    // Normalize HR shape — Vital returns wildly different field shapes
    // depending on the source (Whoop, Oura, Garmin, etc.). We try a few
    // common keys in order of "most likely live value" → "average fallback".
    let currentHR: number | null = null;
    const hr = activity?.heartRate;
    if (typeof hr === 'number') {
      currentHR = hr;
    } else if (hr && typeof hr === 'object') {
      const h = hr as Record<string, unknown>;
      const candidate =
        (typeof h.current === 'number' && h.current) ||
        (typeof h.last === 'number' && h.last) ||
        (typeof h.latest === 'number' && h.latest) ||
        (typeof h.avg === 'number' && h.avg) ||
        (typeof h.average === 'number' && h.average) ||
        (typeof h.max === 'number' && h.max) ||
        null;
      if (typeof candidate === 'number') currentHR = candidate;
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      provider: conn.provider,
      lastSyncAt: conn.lastSyncAt,
      snapshot: sync,
      currentHR,
    });
  } catch (err) {
    console.error('[api/wearables/latest] read failed:', err);
    return NextResponse.json(
      { error: 'Failed to read latest wearable snapshot' },
      { status: 500 }
    );
  }
}
