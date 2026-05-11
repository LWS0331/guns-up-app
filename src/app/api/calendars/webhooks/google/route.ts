// POST /api/calendars/webhooks/google
//
// Receiver for Google Calendar push notifications (events.watch
// channels). Google calls this every time a subscribed calendar
// changes; we look up the matching CalendarConnection by channel id,
// verify the channel token (shared secret), and trigger a sync.
//
// Google headers we read:
//   X-Goog-Channel-Id      — uuid we generated at watch registration
//   X-Goog-Channel-Token   — secret we set on the channel; echoed back
//   X-Goog-Resource-Id     — Google's id for the watched resource
//   X-Goog-Resource-State  — 'sync' (handshake) | 'exists' | 'not_exists'
//
// Sync semantics:
//   - resource_state='sync' on initial channel handshake → 200 no-op.
//   - resource_state='exists'/'not_exists' → trigger sync.
//
// Safety: must return 200 quickly so Google doesn't retry-storm us.
// We dispatch the sync work but don't await it for headers like
// 'sync' that don't need it; for real changes we run sync inline and
// still keep it tight (single connection, no cascade).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isWebhooksEnabled, readWatchState } from '@/lib/calendarWatch';
import { syncGoogleConnection } from '@/lib/calendarSync';

export async function POST(req: NextRequest) {
  if (!isWebhooksEnabled()) {
    // Quiet 200 so Google doesn't bombard us with retries if a stale
    // channel hits us after the flag flips off. We don't want this
    // to error-log on every retry — it's expected.
    return new NextResponse(null, { status: 200 });
  }

  const channelId = req.headers.get('x-goog-channel-id');
  const channelToken = req.headers.get('x-goog-channel-token');
  const resourceState = req.headers.get('x-goog-resource-state');

  if (!channelId) {
    // Not a valid Google push — could be a probe. 400 silently.
    return new NextResponse(null, { status: 400 });
  }

  // Initial sync handshake — Google sends this right after watch
  // registration to confirm we're listening. No work to do.
  if (resourceState === 'sync') {
    return new NextResponse(null, { status: 200 });
  }

  // We can't query JSON path directly via Prisma; small connection
  // table means a scan is acceptable for the lookup.
  const candidates = await prisma.calendarConnection.findMany({
    where: { provider: 'google', active: true },
  });

  let match = null;
  for (const c of candidates) {
    const watch = readWatchState(c);
    if (watch && watch.channelId === channelId) {
      match = { conn: c, watch };
      break;
    }
  }

  if (!match) {
    // Channel we don't recognize — either expired-and-cleaned-up or
    // belongs to a different deployment. Tell Google to stop pinging
    // by returning a 200 (so it doesn't retry) but log for diagnostics.
    console.warn('[calendar webhook] unknown channel:', channelId);
    return new NextResponse(null, { status: 200 });
  }

  if (channelToken !== match.watch.token) {
    console.warn('[calendar webhook] bad channel token for', channelId);
    return new NextResponse(null, { status: 401 });
  }

  // Run the sync inline. It's a single connection — bounded work.
  try {
    const result = await syncGoogleConnection(match.conn);
    if (!result.ok) {
      console.warn(
        '[calendar webhook] sync failed',
        result.code,
        result.error,
        'connection',
        match.conn.id,
      );
    }
  } catch (err) {
    console.error('[calendar webhook] sync threw:', err);
  }
  return new NextResponse(null, { status: 200 });
}
