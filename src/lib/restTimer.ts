// Rest-timer parsing + fallback (WS2, May 2026).
//
// Before this module existed, the auto-start path in Planner.tsx
// ran a single inline regex against the prescription:
//   /(?:rest|Rest|REST)\s*:?\s*(\d+)\s*:?\s*(\d+)?/i
// That only matched explicit "rest 2:00" / "rest 90" formats. Any
// prescription Gunny emitted without an explicit rest token — and
// many do, especially anything generated from a structured set/rep
// scheme — would NOT auto-start a timer, so the operator would tap
// COMPLETE on a set and sit in silence. That's the symptom WS2 is
// fixing: "the rest timer is inconsistent — sometimes starts,
// sometimes doesn't."
//
// New behavior:
//   1. parseRestSeconds(prescription) returns a number if it can
//      extract a rest hint from the string. The regex bank is
//      broader (handles ranges, "min" / "sec" units, no-keyword
//      bare numbers near a "rest" anchor, etc.).
//   2. resolveRestSeconds(prescription, prefs) returns the parsed
//      value when present, otherwise the operator's configured
//      defaultRestSec, otherwise a hardcoded floor.
//   3. The caller in Planner ALWAYS gets a positive number (assuming
//      the operator hasn't explicitly set defaultRestSec=0 to opt
//      out). The timer always starts.
//
// Source-of-truth flag (`from`) is returned so the UI can surface
// "from prescription" vs "your default 2:00" hints without needing
// to re-parse. That's a UX win but optional — callers can ignore it.

export interface RestTimerResolution {
  /** Seconds. Always >= 0; 0 means "don't auto-start." */
  seconds: number;
  /** Where the number came from — useful for UI hints. */
  from: 'prescription' | 'preference_default' | 'app_default' | 'opted_out';
  /** Optional debug string — what substring of the prescription matched. */
  matched?: string;
}

/** Hardcoded fallback when neither prescription nor pref has a value.
 *  120s = 2 min, a reasonable accessory-lift default. Compound lifts
 *  typically warrant 3 min; operators who care will set their own
 *  defaultRestSec. */
export const APP_DEFAULT_REST_SEC = 120;

/** Cap on parsed values so a bogus prescription ("rest 9999 min") can't
 *  lock the operator into a 6-day rest timer. 10 min is generous for
 *  even max-effort triples. */
const MAX_REASONABLE_REST_SEC = 10 * 60;

/**
 * Extract a rest hint from a prescription string. Returns null when no
 * confident match. Regex bank — checked in order, first match wins:
 *
 *   1. "rest 2:00" / "rest: 2:00" — explicit colon time
 *   2. "rest 90 sec" / "rest 2 min" — keyword + unit
 *   3. "2 min rest" / "90s rest" — unit + keyword (reversed order)
 *   4. "rest 90-120" / "rest 2-3 min" — range; take the LOW end so
 *      we don't overshoot the operator's window
 *   5. "rest 90" — bare number after keyword (default unit = seconds)
 *   6. ":90" alone — likely a time annotation; only honored when
 *      it's standalone on its own line / segment, not 4x8 @8 because
 *      that ":" matches RPE colons
 */
export function parseRestSeconds(
  prescription: string | undefined | null,
): { seconds: number; matched: string } | null {
  if (!prescription) return null;
  const s = prescription;

  // 1. Explicit MM:SS after "rest"
  let m = s.match(/\brest(?:\s*period)?\s*[:=-]?\s*(\d{1,2})\s*[:.]\s*(\d{2})\b/i);
  if (m) {
    const total = Number(m[1]) * 60 + Number(m[2]);
    if (total > 0 && total <= MAX_REASONABLE_REST_SEC) {
      return { seconds: total, matched: m[0] };
    }
  }

  // 2. "rest 90 sec" / "rest 2 min" — keyword + value + unit
  m = s.match(/\brest(?:\s*period)?\s*[:=-]?\s*(\d{1,3})\s*(s|sec|second|seconds|m|min|minute|minutes)\b/i);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const total = unit.startsWith('m') ? n * 60 : n;
    if (total > 0 && total <= MAX_REASONABLE_REST_SEC) {
      return { seconds: total, matched: m[0] };
    }
  }

  // 3. "2 min rest" / "90s rest" — value + unit + keyword (reversed)
  m = s.match(/(\d{1,3})\s*(s|sec|second|seconds|m|min|minute|minutes)\s+rest\b/i);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2].toLowerCase();
    const total = unit.startsWith('m') ? n * 60 : n;
    if (total > 0 && total <= MAX_REASONABLE_REST_SEC) {
      return { seconds: total, matched: m[0] };
    }
  }

  // 4. Range: "rest 90-120s" / "rest 2-3 min" — take low end (more
  //    aggressive recovery = more honest rest cap).
  m = s.match(/\brest(?:\s*period)?\s*[:=-]?\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\s*(s|sec|second|seconds|m|min|minute|minutes)?\b/i);
  if (m) {
    const low = Number(m[1]);
    const unit = (m[3] || 'sec').toLowerCase();
    const total = unit.startsWith('m') ? low * 60 : low;
    if (total > 0 && total <= MAX_REASONABLE_REST_SEC) {
      return { seconds: total, matched: m[0] };
    }
  }

  // 5. "rest 90" / "rest: 90" — bare number after keyword.
  //    Default unit: SECONDS. (Operators write "rest 2" rarely
  //    meaning 2 min — they tend to write "2 min" explicitly.)
  m = s.match(/\brest(?:\s*period)?\s*[:=-]?\s*(\d{1,3})\b/i);
  if (m) {
    const total = Number(m[1]);
    // Disambiguation guard: bare "rest 2" without unit is more
    // likely 2 minutes than 2 seconds. Numbers 1-5 with no unit
    // get upgraded to minutes.
    const inferred = total <= 5 ? total * 60 : total;
    if (inferred > 0 && inferred <= MAX_REASONABLE_REST_SEC) {
      return { seconds: inferred, matched: m[0] };
    }
  }

  return null;
}

/**
 * End-to-end resolver — returns the rest seconds the timer should use,
 * factoring in: prescription parse → operator preference → app default.
 *
 * Set `defaultRestSec` to 0 in preferences to opt out of auto-start
 * (the operator manages rest manually). The resolver returns
 * `{ seconds: 0, from: 'opted_out' }` in that case so the caller can
 * skip starting.
 */
export function resolveRestSeconds(
  prescription: string | undefined | null,
  defaultRestSec: number | undefined,
): RestTimerResolution {
  const parsed = parseRestSeconds(prescription);
  if (parsed && parsed.seconds > 0) {
    return { seconds: parsed.seconds, from: 'prescription', matched: parsed.matched };
  }
  // Operator-opted-out signal: explicit 0 in preferences.
  if (defaultRestSec === 0) {
    return { seconds: 0, from: 'opted_out' };
  }
  if (typeof defaultRestSec === 'number' && defaultRestSec > 0) {
    const clamped = Math.min(defaultRestSec, MAX_REASONABLE_REST_SEC);
    return { seconds: clamped, from: 'preference_default' };
  }
  return { seconds: APP_DEFAULT_REST_SEC, from: 'app_default' };
}
