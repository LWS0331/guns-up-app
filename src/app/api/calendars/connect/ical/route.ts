// POST /api/calendars/connect/ical
//
// Phase 2 calendar integration entry point — operator pastes a public
// iCal/webcal URL (Apple Calendar share, Outlook publish, etc.) and
// we register it as a CalendarConnection with provider='ical_url'.
// No OAuth, no tokens, no per-provider scopes. The first sync runs
// inline so the operator gets immediate feedback ("connected · 12
// events found") instead of "connected · 0 events" with a tap-SYNC
// breadcrumb.
//
// Auth: requireAuth — operator registers their OWN feed. Admin
// override path can come later via DELETE/UPDATE.
//
// Feature-flagged via isIcalCalendarEnabledServer() so the route
// 503s cleanly if the rollout isn't lit.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { isIcalCalendarEnabledServer } from '@/lib/featureFlags';
import {
  fetchAndParseIcal,
  IcalFetchError,
  type IcalFetchResult,
} from '@/lib/calendarIcal';

const PROVIDER = 'ical_url';

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!isIcalCalendarEnabledServer()) {
    return NextResponse.json(
      { error: 'iCal calendar integration not enabled.', code: 'feature_disabled' },
      { status: 503 },
    );
  }

  let body: { url?: string; label?: string } | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const rawUrl = (body?.url || '').trim();
  if (!rawUrl) {
    return NextResponse.json(
      { error: 'url required', code: 'missing_url' },
      { status: 400 },
    );
  }
  // Friendly account label for the UI — e.g. "Apple Calendar (Work)".
  // Optional; falls back to the hostname.
  const labelRaw = typeof body?.label === 'string' ? body.label.trim().slice(0, 80) : '';

  let parsed: IcalFetchResult;
  try {
    parsed = await fetchAndParseIcal(rawUrl);
  } catch (err) {
    if (err instanceof IcalFetchError) {
      const status = err.code === 'blocked_host' ? 403 : 400;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.error('[api/calendars/connect/ical] unexpected error:', err);
    return NextResponse.json(
      { error: 'Calendar fetch failed unexpectedly.', code: 'unknown' },
      { status: 500 },
    );
  }

  // Default the providerAccountId to a friendly label so the UI can
  // render "as <label>" the same way the Google path does. Falls back
  // to the hostname when no label was passed.
  const hostname = (() => {
    try {
      return new URL(rawUrl.replace(/^webcal:/i, 'https:')).hostname;
    } catch {
      return null;
    }
  })();
  const accountLabel = labelRaw || hostname || 'ical';

  // Upsert — the schema unique-constrains (operatorId, provider), so
  // the operator can only have one active iCal connection at a time.
  // Re-connecting with a different URL replaces the old one and
  // bumps lastSyncAt.
  const conn = await prisma.calendarConnection.upsert({
    where: { operatorId_provider: { operatorId: auth.operatorId, provider: PROVIDER } },
    create: {
      operatorId: auth.operatorId,
      provider: PROVIDER,
      providerAccountId: accountLabel,
      externalCalId: rawUrl,
      accessTokenEnc: null,
      refreshTokenEnc: null,
      tokenExpiresAt: null,
      scopes: 'readonly',
      active: true,
      lastSyncAt: new Date(),
      syncData: {
        events: parsed.events,
        windowStart: parsed.windowStart,
        windowEnd: parsed.windowEnd,
        eventCount: parsed.events.length,
      } as unknown as Parameters<typeof prisma.calendarConnection.upsert>[0]['create']['syncData'],
    },
    update: {
      providerAccountId: accountLabel,
      externalCalId: rawUrl,
      active: true,
      scopes: 'readonly',
      // Re-connecting must clear any tokens lingering from a prior
      // provider swap (e.g. operator re-uses the slot for a new URL).
      accessTokenEnc: null,
      refreshTokenEnc: null,
      tokenExpiresAt: null,
      lastSyncAt: new Date(),
      syncData: {
        events: parsed.events,
        windowStart: parsed.windowStart,
        windowEnd: parsed.windowEnd,
        eventCount: parsed.events.length,
      } as unknown as Parameters<typeof prisma.calendarConnection.upsert>[0]['update']['syncData'],
    },
    select: { id: true, providerAccountId: true, lastSyncAt: true },
  });

  return NextResponse.json({
    ok: true,
    connection: {
      id: conn.id,
      provider: PROVIDER,
      providerAccountId: conn.providerAccountId,
      lastSyncAt: conn.lastSyncAt,
      eventCount: parsed.events.length,
    },
  });
}
