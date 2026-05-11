// Write-back helpers — Phase 3, code-only. NOT yet wired into the
// daily-ops pipeline. Wiring is a separate PR because it requires:
//
//   1. Upgrading the OAuth scope from calendar.readonly → calendar.events
//      (or running a second OAuth client with the broader scope as an
//      opt-in for write-back users). That forces every connected
//      operator to re-authorize — UX-significant, deserves its own
//      gated rollout.
//   2. A UI toggle so the operator can opt in (most operators do NOT
//      want Gunny writing to their primary calendar — that violates
//      the "read-only by default" promise we made on the connect
//      surface). Read-only stays the default; write-back is explicit.
//   3. A naming/colorization convention for Gunny-created events so
//      they're visually distinct from operator-created events and
//      can be cleanly deleted on disconnect.
//
// What this module does ship:
//   - createCalendarEvent / updateCalendarEvent / deleteCalendarEvent
//     against Google Calendar's events.* API.
//   - Pre-flight scope check — returns 'scope_insufficient' instead of
//     blindly calling the API with a token that'll 403.
//   - Feature flag gate: GOOGLE_CALENDAR_WRITE_BACK_ENABLED. With the
//     flag off, every entry point returns 'feature_disabled'.

import type { CalendarConnection } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { getGoogleCalendarConfig, refreshAccessToken } from '@/lib/oauthGoogle';
import { decryptToken, encryptToken } from '@/lib/calendarTokens';

const WRITE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar',
];

const REFRESH_BUFFER_MS = 60_000;

export interface CalendarEventInput {
  /** Short title shown on the calendar tile. Required. */
  summary: string;
  /** Inclusive ISO start. Required. */
  startISO: string;
  /** Exclusive ISO end. Required. */
  endISO: string;
  /** Optional rich description for the tile detail view. */
  description?: string;
  /** Optional location string (rendered as plain text). */
  location?: string;
  /**
   * Stable identifier from our side, used to de-duplicate writes when
   * the same Daily Ops block is regenerated. Sets the iCalUID on
   * Google's side so events.import (or events.insert with a known
   * UID) is idempotent.
   */
  externalId?: string;
}

export type WriteResultCode =
  | 'feature_disabled'
  | 'scope_insufficient'
  | 'no_connection'
  | 'token_unavailable'
  | 'api_error'
  | 'reauth_required';

export interface WriteOk {
  ok: true;
  /** Google's resource id for the created/updated event. */
  eventId: string;
  htmlLink?: string;
}

export interface WriteErr {
  ok: false;
  code: WriteResultCode;
  error: string;
}

export type WriteResult = WriteOk | WriteErr;

export function isWriteBackEnabled(): boolean {
  return process.env.GOOGLE_CALENDAR_WRITE_BACK_ENABLED === 'true';
}

/** Does this connection's scope grant calendar-event write access? */
export function connectionHasWriteScope(conn: CalendarConnection): boolean {
  if (!conn.scopes) return false;
  const granted = conn.scopes.split(/\s+/).filter(Boolean);
  return WRITE_SCOPES.some((s) => granted.includes(s));
}

/**
 * Ensure the connection has a fresh access token. Mirrors the same
 * refresh-on-expiry logic in calendarSync — refactored out so it
 * doesn't drift. Returns a string token on success, or a WriteErr
 * the caller can return directly.
 */
async function ensureFreshGoogleToken(
  conn: CalendarConnection,
): Promise<{ token: string } | WriteErr> {
  let accessToken = decryptToken(conn.accessTokenEnc ?? '');
  const refreshToken = decryptToken(conn.refreshTokenEnc ?? '');

  const needsRefresh =
    !accessToken ||
    !conn.tokenExpiresAt ||
    conn.tokenExpiresAt.getTime() - Date.now() < REFRESH_BUFFER_MS;

  if (needsRefresh) {
    if (!refreshToken) {
      return { ok: false, code: 'reauth_required', error: 'No refresh token on file.' };
    }
    let config;
    try {
      config = getGoogleCalendarConfig();
    } catch {
      return { ok: false, code: 'token_unavailable', error: 'OAuth config missing.' };
    }
    try {
      const refreshed = await refreshAccessToken(config, refreshToken);
      accessToken = refreshed.access_token;
      await prisma.calendarConnection.update({
        where: { id: conn.id },
        data: {
          accessTokenEnc: encryptToken(refreshed.access_token),
          tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });
    } catch {
      return { ok: false, code: 'reauth_required', error: 'Token refresh failed.' };
    }
  }

  if (!accessToken) {
    return { ok: false, code: 'token_unavailable', error: 'Access token missing.' };
  }
  return { token: accessToken };
}

function preflight(conn: CalendarConnection | null): WriteErr | null {
  if (!isWriteBackEnabled()) {
    return { ok: false, code: 'feature_disabled', error: 'Write-back not enabled.' };
  }
  if (!conn) {
    return { ok: false, code: 'no_connection', error: 'No active Google connection.' };
  }
  if (conn.provider !== 'google') {
    return { ok: false, code: 'no_connection', error: 'Write-back is Google-only.' };
  }
  if (!connectionHasWriteScope(conn)) {
    return {
      ok: false,
      code: 'scope_insufficient',
      error: 'Connection grants only calendar.readonly. Operator must reconnect with calendar.events scope.',
    };
  }
  return null;
}

/**
 * Create a new event on the operator's primary calendar.
 * Uses events.insert with iCalUID for idempotency when externalId is
 * provided — calling with the same externalId twice updates rather
 * than duplicates.
 */
export async function createCalendarEvent(
  conn: CalendarConnection,
  input: CalendarEventInput,
): Promise<WriteResult> {
  const pf = preflight(conn);
  if (pf) return pf;
  const t = await ensureFreshGoogleToken(conn);
  if ('code' in t) return t;

  const payload: Record<string, unknown> = {
    summary: input.summary,
    start: { dateTime: input.startISO },
    end: { dateTime: input.endISO },
  };
  if (input.description) payload.description = input.description;
  if (input.location) payload.location = input.location;
  if (input.externalId) payload.iCalUID = input.externalId;

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.externalCalId)}/events`,
  );

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${t.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { ok: false, code: 'api_error', error: (err as Error).message || 'fetch error' };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 401) {
      return { ok: false, code: 'reauth_required', error: detail.slice(0, 200) };
    }
    return { ok: false, code: 'api_error', error: `HTTP ${res.status}: ${detail.slice(0, 200)}` };
  }
  const data = (await res.json()) as { id?: string; htmlLink?: string };
  if (!data.id) {
    return { ok: false, code: 'api_error', error: 'Google response missing event id.' };
  }
  return { ok: true, eventId: data.id, htmlLink: data.htmlLink };
}

/** PATCH an existing event by Google's event id. */
export async function updateCalendarEvent(
  conn: CalendarConnection,
  eventId: string,
  patch: Partial<CalendarEventInput>,
): Promise<WriteResult> {
  const pf = preflight(conn);
  if (pf) return pf;
  const t = await ensureFreshGoogleToken(conn);
  if ('code' in t) return t;

  const payload: Record<string, unknown> = {};
  if (patch.summary !== undefined) payload.summary = patch.summary;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.location !== undefined) payload.location = patch.location;
  if (patch.startISO) payload.start = { dateTime: patch.startISO };
  if (patch.endISO) payload.end = { dateTime: patch.endISO };

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.externalCalId)}/events/${encodeURIComponent(eventId)}`,
  );

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${t.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    return { ok: false, code: 'api_error', error: (err as Error).message || 'fetch error' };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    if (res.status === 401) {
      return { ok: false, code: 'reauth_required', error: detail.slice(0, 200) };
    }
    return { ok: false, code: 'api_error', error: `HTTP ${res.status}: ${detail.slice(0, 200)}` };
  }
  const data = (await res.json()) as { id?: string; htmlLink?: string };
  if (!data.id) {
    return { ok: false, code: 'api_error', error: 'Google response missing event id.' };
  }
  return { ok: true, eventId: data.id, htmlLink: data.htmlLink };
}

/** DELETE an existing event by Google's event id. 204 = success. */
export async function deleteCalendarEvent(
  conn: CalendarConnection,
  eventId: string,
): Promise<WriteResult> {
  const pf = preflight(conn);
  if (pf) return pf;
  const t = await ensureFreshGoogleToken(conn);
  if ('code' in t) return t;

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.externalCalId)}/events/${encodeURIComponent(eventId)}`,
  );

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${t.token}` },
    });
  } catch (err) {
    return { ok: false, code: 'api_error', error: (err as Error).message || 'fetch error' };
  }
  if (res.status === 204 || res.status === 200) {
    return { ok: true, eventId };
  }
  const detail = await res.text().catch(() => '');
  if (res.status === 401) {
    return { ok: false, code: 'reauth_required', error: detail.slice(0, 200) };
  }
  if (res.status === 410) {
    // Already gone — treat as success.
    return { ok: true, eventId };
  }
  return { ok: false, code: 'api_error', error: `HTTP ${res.status}: ${detail.slice(0, 200)}` };
}
