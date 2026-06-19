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

/**
 * Consecutive-day completed-workout streak ending at `today`. Today
 * itself may still be pending (a gap only breaks the streak on a day
 * before today), so a streak built yesterday still shows until midnight.
 */
export function computeWorkoutStreak(
  workouts: Record<string, unknown> | undefined,
  today: string,
): number {
  const w = workouts || {};
  const d = new Date(today + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return 0;
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const key = toLocalDateStr(d);
    if ((w[key] as Completedish)?.completed) streak++;
    else if (i > 0) break;
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
 */
export function computeCompliance(
  workouts: Record<string, unknown> | undefined,
  today: string,
  windowDays = 7,
): number | null {
  const w = workouts || {};
  const todayMs = new Date(today + 'T12:00:00').getTime();
  if (Number.isNaN(todayMs)) return null;
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  let scheduled = 0;
  let completed = 0;
  for (const [date, entry] of Object.entries(w)) {
    const dayMs = new Date(date + 'T12:00:00').getTime();
    if (Number.isNaN(dayMs)) continue;
    const age = todayMs - dayMs;
    if (age < 0 || age > windowMs) continue;
    scheduled++;
    if ((entry as Completedish)?.completed) completed++;
  }
  return scheduled > 0 ? Math.round((completed / scheduled) * 100) : null;
}
