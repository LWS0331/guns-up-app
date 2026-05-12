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
