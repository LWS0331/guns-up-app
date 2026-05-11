// GET /api/cron/calendar-sync
//
// Phase 3 — periodic refresh of every active CalendarConnection so
// Daily Ops doesn't depend on the operator manually tapping SYNC NOW
// or on Google's push webhooks reaching us (those can lag or expire).
// Walks rows in parallel, batches capped via syncManyConnections.
//
// Auth: CRON_SECRET via Bearer (shared requireCronAuth helper).
//
// Recommended schedule: every 15-30 minutes. We don't need real-time
// — Daily Ops reads against a 7-day window — but stale-by-an-hour is
// noticeably worse than stale-by-15-minutes when the operator just
// added a meeting and asks Gunny to re-shape the day.
//
// Idempotent — safe to retry. Failures don't abort the batch; each
// connection's outcome is logged separately so a single revoked-token
// row doesn't cascade.

import { NextRequest, NextResponse } from 'next/server';
import { requireCronAuth } from '@/lib/cronAuth';
import {
  isGoogleCalendarOauthEnabledServer,
  isIcalCalendarEnabledServer,
} from '@/lib/featureFlags';
import { syncManyConnections } from '@/lib/calendarSync';
import { renewExpiringWatches } from '@/lib/calendarWatch';

export async function GET(req: NextRequest) {
  const denied = requireCronAuth(req);
  if (denied) return denied;

  const googleEnabled = isGoogleCalendarOauthEnabledServer();
  const icalEnabled = isIcalCalendarEnabledServer();
  if (!googleEnabled && !icalEnabled) {
    return NextResponse.json({
      ok: true,
      skipped: 'feature_disabled',
      scanned: 0,
    });
  }

  // Optional operatorId/provider filters for admin spot-checks.
  // No filter → sweep every active connection on the deployment.
  const url = new URL(req.url);
  const operatorId = url.searchParams.get('operatorId') ?? undefined;
  const provider = url.searchParams.get('provider') ?? undefined;
  const limitRaw = url.searchParams.get('limit');
  const limit = limitRaw ? Math.max(1, Math.min(5000, Number(limitRaw))) : undefined;

  const summary = await syncManyConnections({ operatorId, provider, limit });

  // Renew any push-notification channels expiring within 7 days. The
  // operation is no-op when GOOGLE_CALENDAR_WEBHOOKS_ENABLED is off,
  // so it's safe to call unconditionally here. We do this AFTER sync
  // so a fresh access token is more likely to be on file (the sync
  // path refreshes when needed).
  const watch = await renewExpiringWatches();

  // eslint-disable-next-line no-console
  console.info('[cron/calendar-sync]', {
    scanned: summary.scanned,
    ok: summary.ok,
    failed: summary.failed,
    reauthRequired: summary.reauthRequired,
    watchRenewed: watch.renewed,
    watchFailed: watch.failed,
  });

  return NextResponse.json({
    ok: true,
    scanned: summary.scanned,
    succeeded: summary.ok,
    failed: summary.failed,
    reauthRequired: summary.reauthRequired,
    watch,
    // Limit results in the response — full per-connection results can
    // bloat a cron-runner log. Surface the first 20 for diagnostics.
    sampleResults: summary.results.slice(0, 20),
  });
}
