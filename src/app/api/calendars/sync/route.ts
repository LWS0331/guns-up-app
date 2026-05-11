// POST /api/calendars/sync
//
// Pulls the next 7 days of events from each of the operator's active
// CalendarConnection rows (Google and/or iCal-URL) and caches them
// into syncData. Manual-only for Phase 1/2 — the CalendarConnect UI
// surfaces a "SYNC NOW" button. Phase 3 wires a cron + Google push
// webhook so the cache stays fresh without operator action.
//
// Provider dispatch:
//   - 'google'   → OAuth2 events.list with refresh-on-expiry
//   - 'ical_url' → fetch + parse the public .ics URL (no tokens)
//
// Optional ?provider=google body field syncs only that provider —
// otherwise we sync every active connection in parallel and return
// per-connection results so the UI can render structured feedback.
//
// Token refresh (google): if tokenExpiresAt is past or within 60s of
// expiry, we call refreshAccessToken first, re-encrypt + persist the
// new access_token + tokenExpiresAt, then proceed with events.list.
// If refresh itself fails (operator revoked access in their Google
// account), we mark the connection inactive and surface "reconnect
// required" so the UI can prompt re-auth.
//
// Auth: requireAuth — operator syncs their own connections. Admin
// bulk-sync is a separate cron tool (/api/cron/calendar-sync).

import { NextRequest, NextResponse } from 'next/server';
import type { CalendarConnection } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import {
  isGoogleCalendarOauthEnabledServer,
  isIcalCalendarEnabledServer,
} from '@/lib/featureFlags';
import { getGoogleCalendarConfig, refreshAccessToken } from '@/lib/oauthGoogle';
import { decryptToken, encryptToken } from '@/lib/calendarTokens';
import { fetchAndParseIcal, IcalFetchError } from '@/lib/calendarIcal';

const REFRESH_BUFFER_MS = 60_000;
const SYNC_WINDOW_DAYS = 7;
const MAX_EVENTS = 250;

interface GoogleEventTime {
  dateTime?: string;
  date?: string;
  timeZone?: string;
}

interface GoogleEvent {
  id?: string;
  summary?: string;
  status?: string;
  start?: GoogleEventTime;
  end?: GoogleEventTime;
  location?: string;
  transparency?: string;
}

interface NormalizedEvent {
  title: string;
  startISO: string;
  endISO: string;
  allDay: boolean;
  location?: string;
}

interface ConnectionSyncResult {
  provider: string;
  ok: boolean;
  eventCount?: number;
  windowStart?: string;
  windowEnd?: string;
  error?: string;
  code?: string;
}

function normalizeGoogleEvent(e: GoogleEvent): NormalizedEvent | null {
  if (e.status === 'cancelled') return null;
  if (e.transparency === 'transparent') return null;
  const title = (e.summary || '').trim();
  if (!title) return null;
  const allDay = !!e.start?.date && !e.start?.dateTime;
  const startISO = e.start?.dateTime || e.start?.date || '';
  const endISO = e.end?.dateTime || e.end?.date || '';
  if (!startISO || !endISO) return null;
  return {
    title,
    startISO,
    endISO,
    allDay,
    ...(e.location ? { location: e.location.trim() } : {}),
  };
}

/**
 * Sync one Google CalendarConnection. Returns a structured result —
 * never throws. Mutates the row (token refresh, syncData write,
 * active=false on terminal auth failures).
 */
async function syncGoogleConnection(
  conn: CalendarConnection,
): Promise<ConnectionSyncResult> {
  let accessToken = decryptToken(conn.accessTokenEnc ?? '');
  const refreshToken = decryptToken(conn.refreshTokenEnc ?? '');

  const needsRefresh =
    !accessToken ||
    !conn.tokenExpiresAt ||
    conn.tokenExpiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;

  if (needsRefresh) {
    if (!refreshToken) {
      await prisma.calendarConnection.update({
        where: { id: conn.id },
        data: { active: false },
      });
      return {
        provider: 'google',
        ok: false,
        error: 'Calendar token expired and no refresh token on file.',
        code: 'reauth_required',
      };
    }
    let config;
    try {
      config = getGoogleCalendarConfig();
    } catch (err) {
      console.error('[calendars/sync] google config error:', err);
      return {
        provider: 'google',
        ok: false,
        error: 'Google calendar OAuth not configured.',
        code: 'not_configured',
      };
    }
    try {
      const refreshed = await refreshAccessToken(config, refreshToken);
      accessToken = refreshed.access_token;
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
      await prisma.calendarConnection.update({
        where: { id: conn.id },
        data: {
          accessTokenEnc: encryptToken(refreshed.access_token),
          tokenExpiresAt: newExpiresAt,
        },
      });
    } catch (err) {
      console.warn('[calendars/sync] google refresh failed, marking inactive:', err);
      await prisma.calendarConnection.update({
        where: { id: conn.id },
        data: { active: false },
      });
      return {
        provider: 'google',
        ok: false,
        error: 'Could not refresh calendar token.',
        code: 'reauth_required',
      };
    }
  }

  if (!accessToken) {
    return {
      provider: 'google',
      ok: false,
      error: 'Calendar token unavailable.',
      code: 'token_missing',
    };
  }

  const now = new Date();
  const windowStart = now.toISOString();
  const windowEnd = new Date(
    now.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  const eventsUrl = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.externalCalId)}/events`,
  );
  eventsUrl.searchParams.set('timeMin', windowStart);
  eventsUrl.searchParams.set('timeMax', windowEnd);
  eventsUrl.searchParams.set('singleEvents', 'true');
  eventsUrl.searchParams.set('orderBy', 'startTime');
  eventsUrl.searchParams.set('maxResults', String(MAX_EVENTS));

  let raw: { items?: GoogleEvent[] };
  try {
    const res = await fetch(eventsUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('[calendars/sync] google events.list failed:', res.status, detail.slice(0, 200));
      if (res.status === 401) {
        return {
          provider: 'google',
          ok: false,
          error: 'Calendar token rejected by Google.',
          code: 'reauth_required',
        };
      }
      return {
        provider: 'google',
        ok: false,
        error: `Google Calendar API error: ${res.status}`,
        code: 'google_api_error',
      };
    }
    raw = await res.json();
  } catch (err) {
    console.error('[calendars/sync] google fetch failed:', err);
    return {
      provider: 'google',
      ok: false,
      error: 'Network error fetching Google calendar.',
      code: 'network_error',
    };
  }

  const items = Array.isArray(raw.items) ? raw.items : [];
  const events = items
    .map(normalizeGoogleEvent)
    .filter((e): e is NormalizedEvent => e !== null);

  await prisma.calendarConnection.update({
    where: { id: conn.id },
    data: {
      lastSyncAt: new Date(),
      syncData: {
        events,
        windowStart,
        windowEnd,
        eventCount: events.length,
      } as unknown as Parameters<typeof prisma.calendarConnection.update>[0]['data']['syncData'],
    },
  });

  // eslint-disable-next-line no-console
  console.info('[calendars] sync', {
    operatorId: conn.operatorId,
    provider: 'google',
    eventCount: events.length,
    windowStart,
    windowEnd,
  });

  return {
    provider: 'google',
    ok: true,
    eventCount: events.length,
    windowStart,
    windowEnd,
  };
}

/**
 * Sync one iCal-URL CalendarConnection. The URL lives in
 * externalCalId; there are no tokens to refresh, so this is just
 * fetch+parse+persist.
 */
async function syncIcalConnection(
  conn: CalendarConnection,
): Promise<ConnectionSyncResult> {
  if (!conn.externalCalId) {
    return {
      provider: 'ical_url',
      ok: false,
      error: 'iCal connection missing URL.',
      code: 'missing_url',
    };
  }
  try {
    const parsed = await fetchAndParseIcal(conn.externalCalId);
    await prisma.calendarConnection.update({
      where: { id: conn.id },
      data: {
        lastSyncAt: new Date(),
        syncData: {
          events: parsed.events,
          windowStart: parsed.windowStart,
          windowEnd: parsed.windowEnd,
          eventCount: parsed.events.length,
        } as unknown as Parameters<typeof prisma.calendarConnection.update>[0]['data']['syncData'],
      },
    });
    // eslint-disable-next-line no-console
    console.info('[calendars] sync', {
      operatorId: conn.operatorId,
      provider: 'ical_url',
      eventCount: parsed.events.length,
      windowStart: parsed.windowStart,
      windowEnd: parsed.windowEnd,
    });
    return {
      provider: 'ical_url',
      ok: true,
      eventCount: parsed.events.length,
      windowStart: parsed.windowStart,
      windowEnd: parsed.windowEnd,
    };
  } catch (err) {
    if (err instanceof IcalFetchError) {
      console.warn('[calendars/sync] ical fetch failed:', err.code, err.message);
      return {
        provider: 'ical_url',
        ok: false,
        error: err.message,
        code: err.code,
      };
    }
    console.error('[calendars/sync] ical unexpected error:', err);
    return {
      provider: 'ical_url',
      ok: false,
      error: 'Unexpected iCal sync failure.',
      code: 'unknown',
    };
  }
}

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

  // Optional filter — UI today doesn't pass one, but admin tooling
  // and the cron route do.
  let providerFilter: string | null = null;
  try {
    const body = (await req.json().catch(() => null)) as { provider?: string } | null;
    if (body && typeof body.provider === 'string') {
      providerFilter = body.provider;
    }
  } catch {
    // body is optional; ignore
  }

  const connections = await prisma.calendarConnection.findMany({
    where: {
      operatorId: auth.operatorId,
      active: true,
      ...(providerFilter ? { provider: providerFilter } : {}),
    },
  });

  if (connections.length === 0) {
    return NextResponse.json(
      { error: 'No active calendar connections.', code: 'no_connection' },
      { status: 404 },
    );
  }

  // Sync all active connections in parallel — they're independent.
  const results = await Promise.all(
    connections.map((conn) => {
      if (conn.provider === 'google') {
        if (!googleEnabled) {
          return Promise.resolve<ConnectionSyncResult>({
            provider: 'google',
            ok: false,
            error: 'Google calendar integration not enabled.',
            code: 'feature_disabled',
          });
        }
        return syncGoogleConnection(conn);
      }
      if (conn.provider === 'ical_url') {
        if (!icalEnabled) {
          return Promise.resolve<ConnectionSyncResult>({
            provider: 'ical_url',
            ok: false,
            error: 'iCal calendar integration not enabled.',
            code: 'feature_disabled',
          });
        }
        return syncIcalConnection(conn);
      }
      return Promise.resolve<ConnectionSyncResult>({
        provider: conn.provider,
        ok: false,
        error: 'Unknown provider.',
        code: 'unknown_provider',
      });
    }),
  );

  const anyOk = results.some((r) => r.ok);
  // Preserve the legacy 401 behavior: if Google reauth is required
  // AND no other provider succeeded, surface a 401 so the UI prompts
  // reconnect. Otherwise 200 with per-connection statuses.
  const reauthRequired = results.find(
    (r) => !r.ok && r.code === 'reauth_required',
  );
  if (!anyOk && reauthRequired) {
    return NextResponse.json(
      {
        error: reauthRequired.error,
        code: 'reauth_required',
        results,
      },
      { status: 401 },
    );
  }

  return NextResponse.json({
    ok: anyOk,
    results,
  });
}
