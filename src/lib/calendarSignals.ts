// Calendar-event read + prompt-render helpers for Daily Ops.
//
// The /api/calendars/sync route writes the operator's next-N days of
// events into CalendarConnection.syncData. This module is the
// single read-side: getCalendarEvents fetches the cached events for
// a window and renderCalendarForPrompt formats them into a context
// block Gunny can reason against.
//
// Mirrors the wearable-signals shape (lib/wearableSignals.ts) so the
// Gunny Daily Ops injection point can call both helpers in parallel
// and append both rendered blocks to the same context section.

import { prisma } from '@/lib/db';

export interface ExternalEvent {
  title: string;
  startISO: string;
  endISO: string;
  allDay: boolean;
  location?: string;
}

export interface CalendarSignals {
  provider: string;
  providerAccountId?: string | null;
  lastSyncAt: Date | null;
  windowStartISO: string;
  windowEndISO: string;
  events: ExternalEvent[];
}

interface StoredSyncData {
  events?: unknown;
  windowStart?: unknown;
  windowEnd?: unknown;
}

function coerceEvent(raw: unknown): ExternalEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === 'string' ? r.title : null;
  const startISO = typeof r.startISO === 'string' ? r.startISO : null;
  const endISO = typeof r.endISO === 'string' ? r.endISO : null;
  if (!title || !startISO || !endISO) return null;
  const allDay = r.allDay === true;
  const location = typeof r.location === 'string' && r.location.length > 0 ? r.location : undefined;
  return { title, startISO, endISO, allDay, location };
}

/**
 * Fetch the active CalendarConnection for an operator and return the
 * cached events, optionally filtered to a date window. Returns null
 * when no active connection exists — Gunny callers should treat this
 * as "no calendar context" and skip injection.
 *
 * The fromISO/toISO filter is inclusive of fromISO and exclusive of
 * toISO (standard half-open interval). When omitted, returns the full
 * cached window from the last sync.
 */
export async function getCalendarSignals(
  operatorId: string,
  fromISO?: string,
  toISO?: string,
): Promise<CalendarSignals | null> {
  const conn = await prisma.calendarConnection.findFirst({
    where: { operatorId, active: true },
    orderBy: { connectedAt: 'desc' },
  });
  if (!conn) return null;

  const sync = (conn.syncData as StoredSyncData | null) || {};
  const rawEvents = Array.isArray(sync.events) ? sync.events : [];
  const allEvents = rawEvents
    .map(coerceEvent)
    .filter((e): e is ExternalEvent => e !== null)
    .sort((a, b) => a.startISO.localeCompare(b.startISO));

  const filtered =
    fromISO || toISO
      ? allEvents.filter((e) => {
          if (fromISO && e.endISO < fromISO) return false;
          if (toISO && e.startISO >= toISO) return false;
          return true;
        })
      : allEvents;

  const windowStart = typeof sync.windowStart === 'string' ? sync.windowStart : '';
  const windowEnd = typeof sync.windowEnd === 'string' ? sync.windowEnd : '';

  return {
    provider: conn.provider,
    providerAccountId: conn.providerAccountId ?? null,
    lastSyncAt: conn.lastSyncAt,
    windowStartISO: windowStart,
    windowEndISO: windowEnd,
    events: filtered,
  };
}

function fmtTime(iso: string): string {
  // 24-hour HH:MM in the operator's local time. We deliberately render
  // in the timezone Google returned the event in (the ISO string carries
  // its own offset) — Gunny's Daily Ops prompt already handles operator
  // TZ via clientDateLong, so re-anchoring here would double-shift.
  const m = iso.match(/T(\d{2}):(\d{2})/);
  if (!m) return '??:??';
  return `${m[1]}:${m[2]}`;
}

function fmtDateLabel(iso: string): string {
  // YYYY-MM-DD prefix; Gunny aligns this against clientDate in context.
  return iso.slice(0, 10);
}

/**
 * Render events as a tactical context block for the Gunny system
 * prompt. Slots in next to the wearable + rhythm signals so Gunny
 * can reshape Daily Ops blocks around real meetings.
 *
 * Output is deliberately compact — one line per day, semicolon-
 * separated events. Gunny doesn't need rich markdown; it needs a
 * scannable text shape it can quote back at the operator ("you
 * have a 9am call, moving the workout to 11am").
 */
export function renderCalendarForPrompt(signals: CalendarSignals): string {
  if (!signals.events.length) {
    return [
      '',
      '═══ EXTERNAL CALENDAR (NEXT 7 DAYS) ═══',
      `Provider: ${signals.provider} (last sync: ${signals.lastSyncAt ? signals.lastSyncAt.toISOString() : 'never'})`,
      'No events in window — schedule is wide open.',
    ].join('\n');
  }

  // Group by YYYY-MM-DD.
  const byDay = new Map<string, ExternalEvent[]>();
  for (const e of signals.events) {
    const day = fmtDateLabel(e.startISO);
    const bucket = byDay.get(day);
    if (bucket) {
      bucket.push(e);
    } else {
      byDay.set(day, [e]);
    }
  }

  const lines: string[] = [
    '',
    '═══ EXTERNAL CALENDAR (NEXT 7 DAYS) ═══',
    `Provider: ${signals.provider} (last sync: ${signals.lastSyncAt ? signals.lastSyncAt.toISOString() : 'never'})`,
  ];

  const sortedDays = Array.from(byDay.keys()).sort();
  for (const day of sortedDays) {
    const events = byDay.get(day) || [];
    const segments = events.map((e) => {
      if (e.allDay) {
        return `${e.title} (all-day)${e.location ? ` @ ${e.location}` : ''}`;
      }
      const range = `${fmtTime(e.startISO)}-${fmtTime(e.endISO)}`;
      return `${range} ${e.title}${e.location ? ` @ ${e.location}` : ''}`;
    });
    lines.push(`${day}: ${segments.join('; ')}`);
  }

  lines.push(
    'Use this when building or adjusting Daily Ops blocks — workout windows, meal blocks, and recovery slots MUST avoid conflicts. When you reshape around an event, name the event in your reply ("you have the 9am standup, sliding strength to 11am").',
  );
  return lines.join('\n');
}
