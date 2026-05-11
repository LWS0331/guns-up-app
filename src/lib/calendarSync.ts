// Per-connection sync helpers, extracted from /api/calendars/sync/route.ts
// so the cron (/api/cron/calendar-sync) and the user-driven route can
// share the same provider-dispatch logic without duplication.
//
// One operator can have multiple CalendarConnection rows (e.g. Google
// + iCal); the wrappers below sync all of them in parallel and return
// per-connection structured results.
//
// Side effects:
//   - On a successful sync: writes lastSyncAt + syncData.events.
//   - On Google refresh failure (revoked tokens): sets active=false
//     so the UI can prompt reconnect.

import type { CalendarConnection } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { getGoogleCalendarConfig, refreshAccessToken } from '@/lib/oauthGoogle';
import { decryptToken, encryptToken } from '@/lib/calendarTokens';
import { fetchAndParseIcal, IcalFetchError } from '@/lib/calendarIcal';
import {
  isGoogleCalendarOauthEnabledServer,
  isIcalCalendarEnabledServer,
} from '@/lib/featureFlags';

const REFRESH_BUFFER_MS = 60_000;
const SYNC_WINDOW_DAYS = 7;
const MAX_EVENTS = 250;

export interface NormalizedEvent {
  title: string;
  startISO: string;
  endISO: string;
  allDay: boolean;
  location?: string;
}

export interface ConnectionSyncResult {
  connectionId: string;
  provider: string;
  ok: boolean;
  eventCount?: number;
  windowStart?: string;
  windowEnd?: string;
  error?: string;
  code?: string;
}

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
 * Sync one Google CalendarConnection. Never throws — failures come
 * back as { ok: false, code, error }. The watch field on syncData is
 * preserved across writes so webhook channels survive a sync.
 */
export async function syncGoogleConnection(
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
        connectionId: conn.id,
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
      console.error('[calendarSync] google config error:', err);
      return {
        connectionId: conn.id,
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
      console.warn('[calendarSync] google refresh failed, marking inactive:', err);
      await prisma.calendarConnection.update({
        where: { id: conn.id },
        data: { active: false },
      });
      return {
        connectionId: conn.id,
        provider: 'google',
        ok: false,
        error: 'Could not refresh calendar token.',
        code: 'reauth_required',
      };
    }
  }

  if (!accessToken) {
    return {
      connectionId: conn.id,
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
      console.error('[calendarSync] google events.list failed:', res.status, detail.slice(0, 200));
      if (res.status === 401) {
        return {
          connectionId: conn.id,
          provider: 'google',
          ok: false,
          error: 'Calendar token rejected by Google.',
          code: 'reauth_required',
        };
      }
      return {
        connectionId: conn.id,
        provider: 'google',
        ok: false,
        error: `Google Calendar API error: ${res.status}`,
        code: 'google_api_error',
      };
    }
    raw = await res.json();
  } catch (err) {
    console.error('[calendarSync] google fetch failed:', err);
    return {
      connectionId: conn.id,
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

  // Preserve watch/channel metadata across writes so webhook routing
  // doesn't break after a sync.
  const prevSync = (conn.syncData as Record<string, unknown> | null) || {};
  const watch =
    prevSync && typeof prevSync.watch === 'object' && prevSync.watch !== null
      ? prevSync.watch
      : undefined;

  await prisma.calendarConnection.update({
    where: { id: conn.id },
    data: {
      lastSyncAt: new Date(),
      syncData: {
        events,
        windowStart,
        windowEnd,
        eventCount: events.length,
        ...(watch ? { watch } : {}),
      } as unknown as Parameters<typeof prisma.calendarConnection.update>[0]['data']['syncData'],
    },
  });

  return {
    connectionId: conn.id,
    provider: 'google',
    ok: true,
    eventCount: events.length,
    windowStart,
    windowEnd,
  };
}

/**
 * Sync one iCal-URL CalendarConnection. URL is stored in externalCalId;
 * no tokens to refresh.
 */
export async function syncIcalConnection(
  conn: CalendarConnection,
): Promise<ConnectionSyncResult> {
  if (!conn.externalCalId) {
    return {
      connectionId: conn.id,
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
    return {
      connectionId: conn.id,
      provider: 'ical_url',
      ok: true,
      eventCount: parsed.events.length,
      windowStart: parsed.windowStart,
      windowEnd: parsed.windowEnd,
    };
  } catch (err) {
    if (err instanceof IcalFetchError) {
      return {
        connectionId: conn.id,
        provider: 'ical_url',
        ok: false,
        error: err.message,
        code: err.code,
      };
    }
    console.error('[calendarSync] ical unexpected error:', err);
    return {
      connectionId: conn.id,
      provider: 'ical_url',
      ok: false,
      error: 'Unexpected iCal sync failure.',
      code: 'unknown',
    };
  }
}

/**
 * Dispatch a connection to its provider's sync handler. Honors the
 * per-provider feature flags so a connection from a now-disabled
 * provider returns a structured 'feature_disabled' result instead of
 * silently no-oping.
 */
export async function syncOneConnection(
  conn: CalendarConnection,
): Promise<ConnectionSyncResult> {
  if (conn.provider === 'google') {
    if (!isGoogleCalendarOauthEnabledServer()) {
      return {
        connectionId: conn.id,
        provider: 'google',
        ok: false,
        error: 'Google calendar integration not enabled.',
        code: 'feature_disabled',
      };
    }
    return syncGoogleConnection(conn);
  }
  if (conn.provider === 'ical_url') {
    if (!isIcalCalendarEnabledServer()) {
      return {
        connectionId: conn.id,
        provider: 'ical_url',
        ok: false,
        error: 'iCal calendar integration not enabled.',
        code: 'feature_disabled',
      };
    }
    return syncIcalConnection(conn);
  }
  return {
    connectionId: conn.id,
    provider: conn.provider,
    ok: false,
    error: 'Unknown provider.',
    code: 'unknown_provider',
  };
}

export interface SyncManyArgs {
  /** When provided, scope to one operator. Cron omits to walk all. */
  operatorId?: string;
  /** When provided, scope to one provider (e.g. only renew Google). */
  provider?: string;
  /** Caps the batch size — defends against thundering-herd on cron. */
  limit?: number;
}

export interface SyncManySummary {
  scanned: number;
  ok: number;
  failed: number;
  reauthRequired: number;
  results: ConnectionSyncResult[];
}

/**
 * Sync many connections in parallel. Returns aggregate stats + a
 * per-connection result array. Cron callers should pass `limit` to
 * cap the batch; user-driven calls can leave it unset.
 */
export async function syncManyConnections(
  args: SyncManyArgs = {},
): Promise<SyncManySummary> {
  const connections = await prisma.calendarConnection.findMany({
    where: {
      active: true,
      ...(args.operatorId ? { operatorId: args.operatorId } : {}),
      ...(args.provider ? { provider: args.provider } : {}),
    },
    take: args.limit ?? 5000,
  });

  const results = await Promise.all(connections.map((c) => syncOneConnection(c)));

  const summary: SyncManySummary = {
    scanned: connections.length,
    ok: 0,
    failed: 0,
    reauthRequired: 0,
    results,
  };
  for (const r of results) {
    if (r.ok) summary.ok++;
    else {
      summary.failed++;
      if (r.code === 'reauth_required') summary.reauthRequired++;
    }
  }
  return summary;
}
