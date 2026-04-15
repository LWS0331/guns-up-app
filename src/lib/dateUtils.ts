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
