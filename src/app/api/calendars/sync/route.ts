// POST /api/calendars/sync
//
// Pulls the next 7 days of events from the operator's connected
// Google Calendar and caches them into CalendarConnection.syncData.
// Manual-only for Phase 1 — the CalendarConnect UI surfaces a
// "SYNC NOW" button. Phase 3 will add a cron + webhook so the cache
// stays fresh without operator action.
//
// Token refresh: if tokenExpiresAt is past or within 60s of expiry,
// we call refreshAccessToken first, re-encrypt + persist the new
// access_token + tokenExpiresAt, then proceed with the events.list
// call. If refresh itself fails (operator revoked access in their
// Google account), we mark the connection inactive and surface
// "reconnect required" so the UI can prompt re-auth.
//
// Auth: requireAuth — operator syncs their own calendar. Admins
// can't bulk-sync from this endpoint; that's a separate cron tool
// in Phase 3.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { isGoogleCalendarOauthEnabledServer } from '@/lib/featureFlags';
import { getGoogleCalendarConfig, refreshAccessToken } from '@/lib/oauthGoogle';
import { decryptToken, encryptToken } from '@/lib/calendarTokens';

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
  transparency?: string;  // 'transparent' = "free" → skip
}

interface NormalizedEvent {
  title: string;
  startISO: string;
  endISO: string;
  allDay: boolean;
  location?: string;
}

function normalizeEvent(e: GoogleEvent): NormalizedEvent | null {
  if (e.status === 'cancelled') return null;
  // Skip "free" events — they don't block the operator's schedule.
  if (e.transparency === 'transparent') return null;
  const title = (e.summary || '').trim();
  if (!title) return null;
  // All-day events come back as date (YYYY-MM-DD), timed events as
  // dateTime (full ISO). Normalize both into ISO strings the
  // calendar-signals helper can sort.
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

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!isGoogleCalendarOauthEnabledServer()) {
    return NextResponse.json(
      { error: 'Calendar integration not enabled.', code: 'feature_disabled' },
      { status: 503 },
    );
  }

  const conn = await prisma.calendarConnection.findFirst({
    where: { operatorId: auth.operatorId, provider: 'google', active: true },
  });
  if (!conn) {
    return NextResponse.json(
      { error: 'No active Google Calendar connection.', code: 'no_connection' },
      { status: 404 },
    );
  }

  let accessToken = decryptToken(conn.accessTokenEnc);
  const refreshToken = decryptToken(conn.refreshTokenEnc);

  // Refresh if access token is expired or near-expired. Without the
  // 60s buffer we'd race the token expiry inside the events.list call
  // and have to retry on a 401.
  const needsRefresh =
    !accessToken ||
    !conn.tokenExpiresAt ||
    conn.tokenExpiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;

  if (needsRefresh) {
    if (!refreshToken) {
      // No refresh token AND access token expired/missing — operator
      // must re-authorize. Mark inactive so the UI surfaces the
      // reconnect prompt instead of looping on stale tokens.
      await prisma.calendarConnection.update({
        where: { id: conn.id },
        data: { active: false },
      });
      return NextResponse.json(
        {
          error: 'Calendar token expired and no refresh token on file. Reconnect Google Calendar.',
          code: 'reauth_required',
        },
        { status: 401 },
      );
    }
    let config;
    try {
      config = getGoogleCalendarConfig();
    } catch (err) {
      console.error('[api/calendars/sync] config error:', err);
      return NextResponse.json(
        { error: 'Calendar OAuth config missing.', code: 'not_configured' },
        { status: 503 },
      );
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
      // Refresh failed — most likely the operator revoked access in
      // their Google account. Mark inactive so the UI prompts reconnect.
      console.warn('[api/calendars/sync] refresh failed, marking inactive:', err);
      await prisma.calendarConnection.update({
        where: { id: conn.id },
        data: { active: false },
      });
      return NextResponse.json(
        {
          error: 'Could not refresh calendar token. Reconnect Google Calendar.',
          code: 'reauth_required',
        },
        { status: 401 },
      );
    }
  }

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Calendar token unavailable.', code: 'token_missing' },
      { status: 500 },
    );
  }

  // Fetch events from Google. We use timeMin = now, timeMax = +7d.
  const now = new Date();
  const windowStart = now.toISOString();
  const windowEnd = new Date(now.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

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
      console.error('[api/calendars/sync] events.list failed:', res.status, detail.slice(0, 200));
      // 401 here means the access token died between our refresh check
      // and the call — surface as reauth_required so the UI can prompt.
      if (res.status === 401) {
        return NextResponse.json(
          { error: 'Calendar token rejected by Google.', code: 'reauth_required' },
          { status: 401 },
        );
      }
      return NextResponse.json(
        { error: `Google Calendar API error: ${res.status}`, code: 'google_api_error' },
        { status: 502 },
      );
    }
    raw = await res.json();
  } catch (err) {
    console.error('[api/calendars/sync] fetch failed:', err);
    return NextResponse.json(
      { error: 'Network error fetching calendar.', code: 'network_error' },
      { status: 502 },
    );
  }

  const items = Array.isArray(raw.items) ? raw.items : [];
  const events = items
    .map(normalizeEvent)
    .filter((e): e is NormalizedEvent => e !== null);

  await prisma.calendarConnection.update({
    where: { id: conn.id },
    data: {
      lastSyncAt: new Date(),
      // Cast through unknown to satisfy Prisma's InputJsonValue type —
      // our NormalizedEvent shape is JSON-safe (string/boolean fields
      // only), but TS can't prove that to the strict Prisma type.
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
    operatorId: auth.operatorId,
    provider: 'google',
    eventCount: events.length,
    windowStart,
    windowEnd,
  });

  return NextResponse.json({
    ok: true,
    eventCount: events.length,
    windowStart,
    windowEnd,
  });
}
