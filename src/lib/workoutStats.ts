// Live workout-derived stats — streak + short-window compliance.
//
// These are computed from operator.workouts (source-of-truth) at read
// time. The Daily Brief used to surface `brief.streakDays` /
// `brief.complianceScore`, but those are frozen LLM output baked in when
// the brief was generated (usually in the morning, before the day's
// workout was logged), so they showed stale numbers all day. Computing
// live keeps the COC card honest the moment a workout is marked complete.

import { toLocalDateStr } from './dateUtils';

type Completedish = { completed?: boolean } | undefined;
type Taggish = { color?: string } | undefined;

/** dayTag colors that mark a *scheduled* rest and so bridge the streak /
 *  compliance (cyan = rest day, amber = deload, red = injured/sick). A
 *  green "great session" tag is NOT a rest signal and does not bridge.
 *  Exported so buildGunnyContext's recentCompliance loop reuses one set. */
export const REST_TAG_COLORS = new Set(['cyan', 'amber', 'red']);

/**
 * Consecutive-day completed-workout streak ending at `today`.
 *
 * Walking backward from today, each day:
 *  1. completed workout            → counts (+1)
 *  2. else a scheduled-rest dayTag → bridges (streak continues, no +1)
 *  3. else today itself            → continues (may still be pending)
 *  4. else                         → breaks (untracked gap / missed workout)
 *
 * A scheduled rest (cyan/amber/red dayTag) keeps the streak alive without
 * inflating it: Mon✅,Tue✅,restWed,Thu✅ ⇒ 3. An untracked empty day or a
 * past missed workout (completed:false, no rest tag) still ends the streak.
 */
export function computeWorkoutStreak(
  workouts: Record<string, unknown> | undefined,
  today: string,
  dayTags?: Record<string, unknown>,
): number {
  const w = workouts || {};
  const tags = dayTags || {};
  const d = new Date(today + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return 0;
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const key = toLocalDateStr(d);
    if ((w[key] as Completedish)?.completed) {
      streak++;
    } else if (REST_TAG_COLORS.has((tags[key] as Taggish)?.color ?? '')) {
      // scheduled rest — bridge without incrementing
    } else if (i > 0) {
      break;
    }
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/**
 * Completion rate (0-100) over the trailing `windowDays` days: completed
 * workouts / scheduled workouts (a "scheduled" day is any day with a
 * workout entry). Returns null when nothing was scheduled in the window.
 * Today counts toward scheduled but an incomplete today is not penalized
 * as "missed" — it just isn't completed yet.
 *
 * A scheduled-rest dayTag (cyan/amber/red) bridges compliance the same way
 * it bridges the streak: an *incomplete* day carrying such a tag (e.g. an
 * injured day where the planned session was skipped) is neutral — excluded
 * from the scheduled denominator entirely, not counted as a miss. A
 * *completed* workout still counts even when the day is tagged.
 */
export function computeCompliance(
  workouts: Record<string, unknown> | undefined,
  today: string,
  windowDays = 7,
  dayTags?: Record<string, unknown>,
): number | null {
  const w = workouts || {};
  const tags = dayTags || {};
  const todayMs = new Date(today + 'T12:00:00').getTime();
  if (Number.isNaN(todayMs)) return null;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  let scheduled = 0;
  let completed = 0;
  for (const [date, entry] of Object.entries(w)) {
    const dayMs = new Date(date + 'T12:00:00').getTime();
    if (Number.isNaN(dayMs)) continue;
    const age = todayMs - dayMs;
    // Exclusive upper bound: today + the (windowDays-1) prior days = exactly
    // `windowDays` calendar days. `>` would admit the day exactly windowDays
    // ago, stretching a "last 7 days" window to 8.
    if (age < 0 || age >= windowMs) continue;
    const done = (entry as Completedish)?.completed;
    // Incomplete + scheduled-rest tag → neutral (don't count as scheduled).
    if (!done && REST_TAG_COLORS.has((tags[date] as Taggish)?.color ?? '')) continue;
    scheduled++;
    if (done) completed++;
  }
  return scheduled > 0 ? Math.round((completed / scheduled) * 100) : null;
}
