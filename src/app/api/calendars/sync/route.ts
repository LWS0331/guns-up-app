// POST /api/calendars/sync
//
// User-driven manual sync. Delegates to src/lib/calendarSync.ts so the
// same dispatch logic is shared with /api/cron/calendar-sync.
//
// Optional body: { provider?: string } — sync only that provider.
// Without it, syncs every active connection for the calling operator.
//
// Provider feature flags are enforced inside syncOneConnection; the
// top-level 503 here fires only when BOTH providers are disabled
// globally (so the UI's coming-soon banner gets a clean signal).

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import {
  isGoogleCalendarOauthEnabledServer,
  isIcalCalendarEnabledServer,
} from '@/lib/featureFlags';
import { syncManyConnections } from '@/lib/calendarSync';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const googleEnabled = isGoogleCalendarOauthEnabledServer();
  const icalEnabled = isIcalCalendarEnabledServer();
  if (!googleEnabled && !icalEnabled) {
    return NextResponse.json(
      { error: 'Calendar integration not enabled.', code: 'feature_disabled' },
      { status: 503 },
    );
  }

  let providerFilter: string | undefined;
  try {
    const body = (await req.json().catch(() => null)) as { provider?: string } | null;
    if (body && typeof body.provider === 'string') {
      providerFilter = body.provider;
    }
  } catch {
    // body is optional; ignore
  }

  const summary = await syncManyConnections({
    operatorId: auth.operatorId,
    provider: providerFilter,
  });

  if (summary.scanned === 0) {
    return NextResponse.json(
      { error: 'No active calendar connections.', code: 'no_connection' },
      { status: 404 },
    );
  }

  // Legacy 401 behavior preserved: if reauth is required AND nothing
  // else succeeded, surface a 401 so CalendarConnect can prompt the
  // operator to reconnect Google.
  if (summary.ok === 0 && summary.reauthRequired > 0) {
    const r = summary.results.find((x) => x.code === 'reauth_required');
    return NextResponse.json(
      {
        error: r?.error || 'Calendar reauth required.',
        code: 'reauth_required',
        results: summary.results,
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: summary.ok > 0,
    results: summary.results,
  });
}
