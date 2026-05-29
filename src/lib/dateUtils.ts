// Local-timezone date helpers.
//
// CRITICAL: do NOT use `new Date().toISOString().split('T')[0]` for date keys.
// That returns the UTC date. For a user in PST, at 5 PM local on April 14 the
// UTC date is already April 15 — meals logged "today" get keyed to the wrong
// bucket and silently disappear when the UI filters for today's entries.
//
// Every date key (nutrition.meals[YYYY-MM-DD], workouts[YYYY-MM-DD],
// dayTags[YYYY-MM-DD], dailyBrief.date, etc.) must be derived in the user's
// LOCAL timezone.
//
// CLIENT vs SERVER:
//   - In the browser, "local" means the operator's browser timezone — the
//     no-arg helpers (`getLocalDateStr()`, `toLocalDateStr(d)`) use the JS
//     Date local APIs, which honor that.
//   - On the server (Next.js route, cron, MCP), process timezone is whatever
//     Railway/Docker says it is (UTC by default). For server-minted date keys
//     use `getDateStrInTimezone(date, APP_TIMEZONE)` so we always resolve to
//     Pacific Time regardless of where the container ran.
//
// APP_TIMEZONE is the canonical server-side default (Pacific Time, which
// rolls between PST and PDT). Operators can override per-account via
// `profile.timezone`; the server resolver path is documented at each call site.

/** Canonical app timezone for any server-side date math without an operator
 * context. IANA name; pass directly into `Intl.DateTimeFormat`. */
export const APP_TIMEZONE = 'America/Los_Angeles';

/** Today's date as YYYY-MM-DD in the viewer's local timezone. */
export function getLocalDateStr(): string {
  return toLocalDateStr(new Date());
}

/** Convert a Date to YYYY-MM-DD in the viewer's local timezone. */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format a Date as YYYY-MM-DD in a specific IANA timezone. Server-safe —
 * uses Intl.DateTimeFormat so it doesn't depend on the process TZ env var
 * (which Railway runs as UTC unless explicitly overridden).
 *
 * Defaults: date = now, timezone = APP_TIMEZONE (Pacific). Pass an
 * operator's stored `profile.timezone` to resolve in that operator's
 * local time instead.
 */
export function getDateStrInTimezone(
  date: Date | number | string = new Date(),
  timezone: string = APP_TIMEZONE,
): string {
  const d = date instanceof Date ? date : new Date(date);
  // en-CA renders ISO-style YYYY-MM-DD with zero-padded month/day. Saves
  // a parts-extraction loop vs en-US "MM/DD/YYYY".
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Today's date in APP_TIMEZONE (Pacific). Server-safe convenience wrapper
 * around getDateStrInTimezone() for the most common case. */
export function getAppTodayStr(): string {
  return getDateStrInTimezone(new Date(), APP_TIMEZONE);
}

/** Date offset from today (negative = past), YYYY-MM-DD in local timezone. */
export function getLocalDateStrOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return toLocalDateStr(d);
}

/** Yesterday's local date. */
export function getLocalYesterdayStr(): string {
  return getLocalDateStrOffset(-1);
}

/**
 * Date keys (YYYY-MM-DD, local) from `anchor` through the upcoming Sunday inclusive.
 * Anchor defaults to today; pass a YYYY-MM-DD to anchor explicitly (e.g. the operator's
 * clientDate so server math stays in their timezone). Sunday returns a single entry.
 *
 * Used by the Gunny weekly-build flow so the model never does calendar math —
 * the server injects WEEK_PLAN_DATES and Gunny only ever copies dates from it.
 */
export function getThisWeekDateKeys(anchor?: string): Array<{ key: string; weekday: string }> {
  const start = anchor && isValidDateStr(anchor)
    ? parseLocalDateKey(anchor) ?? new Date()
    : new Date();
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
  const out: Array<{ key: string; weekday: string }> = [];
  // Safety bound — break after 8 iterations even if something is wrong with getDay().
  for (let i = 0; i < 8; i++) {
    out.push({ key: toLocalDateStr(cursor), weekday: WEEKDAYS[cursor.getDay()] });
    if (cursor.getDay() === 0) break; // Sunday is inclusive end
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/** Parse an ISO or loose date string and return its LOCAL date key. */
export function parseToLocalDateStr(input: string | undefined | null): string | null {
  if (!input) return null;
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return toLocalDateStr(d);
}

/** Validate that a string is a plausible YYYY-MM-DD date key. */
export function isValidDateStr(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/**
 * Current IANA timezone name if the runtime exposes it (e.g. "America/Los_Angeles").
 * Returns null when Intl.DateTimeFormat isn't available (very old browsers).
 */
export function getLocalTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Human-friendly local date string for prompts ("Tuesday, April 14, 2026").
 */
export function getLocalDateLongStr(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Local HH:MM (24h) — WS5 context personalization. Sent to /api/gunny
 * so the context block knows what time it actually is for the operator,
 * not just the date. Before WS5 the route had clientDate but not the
 * hour, so any "what should I eat now?" / "should I lift now?" /
 * "is it too late to start a workout?" question got an answer that
 * couldn't account for the actual clock.
 */
export function getLocalHourMinute(): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

/**
 * Coarse time-of-day band for Gunny prompts. Picks one of six labels
 * based on the operator's local clock:
 *   05:00-08:59  early-morning
 *   09:00-11:59  morning
 *   12:00-14:59  midday
 *   15:00-17:59  afternoon
 *   18:00-21:59  evening
 *   22:00-04:59  late-night
 *
 * Bands are intentionally coarse — the prompt also receives the exact
 * HH:MM, so Gunny can refine; the band exists for fast pattern-matching
 * in conditional system-prompt branches ("if late-night, suggest lighter
 * meal options").
 */
export function getLocalTimeOfDayBand(): 'early-morning' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'late-night' {
  const h = new Date().getHours();
  if (h >= 5 && h < 9) return 'early-morning';
  if (h >= 9 && h < 12) return 'morning';
  if (h >= 12 && h < 15) return 'midday';
  if (h >= 15 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  return 'late-night';
}

/**
 * Parse a YYYY-MM-DD date key into a Date anchored at LOCAL midnight.
 *
 * CRITICAL: `new Date('2026-04-22')` parses as UTC midnight, then any subsequent
 * `.toLocaleDateString(...)` conversion shifts it back in time for viewers west
 * of UTC — so a workout keyed 2026-04-22 renders as "Apr 21" in PST. This helper
 * constructs the Date in the viewer's local timezone so the displayed date
 * matches the stored key.
 *
 * Returns null for malformed input.
 */
export function parseLocalDateKey(key: string | undefined | null): Date | null {
  if (!isValidDateStr(key)) return null;
  const [y, m, d] = (key as string).split('-').map(Number);
  return new Date(y, m - 1, d);
}

/**
 * Format a YYYY-MM-DD date key in the viewer's local timezone.
 *
 * Safe replacement for `new Date(dateKey).toLocaleDateString(...)` which has
 * the UTC-parse bug described in parseLocalDateKey. Returns the original key
 * if it's malformed so you can still render something rather than crashing.
 */
export function formatLocalDateKey(
  key: string | undefined | null,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
  locale: string = 'en-US',
): string {
  const parsed = parseLocalDateKey(key);
  if (!parsed) return key ?? '';
  return parsed.toLocaleDateString(locale, options);
}
