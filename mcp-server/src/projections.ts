/**
 * Pure projection helpers for the READ tools — no SDK, no zod, no
 * network. Extracted from tools.ts so the read-shape logic is unit-
 * testable without spinning up an McpServer or stubbing the API client.
 *
 * Each function takes the in-memory Operator record and a small input,
 * and returns the exact JSON shape a tool handler serializes.
 */

import type { MacroTargets, Meal, Operator, Workout } from './api-client.js';

export interface DateRange {
  from: string;
  to: string;
}

/** Throws on inverted ranges. Lexicographic compare is safe for
 * YYYY-MM-DD strings — DATE_KEY enforces that shape upstream. */
export function assertValidDateRange({ from, to }: DateRange): void {
  if (from > to) {
    throw new Error(
      `Invalid range: from (${from}) must be on or before to (${to}).`
    );
  }
}

export function projectWorkoutsInRange(
  op: Operator,
  range: DateRange
): Record<string, Workout> {
  assertValidDateRange(range);
  const all = op.workouts || {};
  const out: Record<string, Workout> = {};
  for (const [date, w] of Object.entries(all)) {
    if (date >= range.from && date <= range.to) out[date] = w;
  }
  return out;
}

export interface NutritionTotals {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface NutritionDay {
  date: string;
  meals: Meal[];
  totals: NutritionTotals;
}

export interface NutritionRangeResult {
  from: string;
  to: string;
  targets: MacroTargets | undefined;
  days: NutritionDay[];
}

export function projectNutritionInRange(
  op: Operator,
  range: DateRange
): NutritionRangeResult {
  assertValidDateRange(range);
  const allMeals =
    (op.nutrition?.meals as Record<string, Meal[]> | undefined) || {};
  const targets = op.nutrition?.targets;
  const days: NutritionDay[] = [];
  for (const [date, meals] of Object.entries(allMeals)) {
    if (date < range.from || date > range.to) continue;
    const totals = meals.reduce<NutritionTotals>(
      (acc, m) => ({
        calories: acc.calories + (m.calories || 0),
        protein: acc.protein + (m.protein || 0),
        carbs: acc.carbs + (m.carbs || 0),
        fat: acc.fat + (m.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
    days.push({ date, meals, totals });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  return { from: range.from, to: range.to, targets, days };
}

export interface ProfileSummary {
  id: string;
  callsign: string | undefined;
  name: string | undefined;
  intake: unknown;
  profile: unknown;
  preferences: unknown;
  sitrep: unknown;
  dailyBrief: unknown;
  /** True when dailyBrief was dropped because it was dated before today. */
  dailyBriefStale: boolean;
  /** True when sitrep.generatedDate is before today — its embedded
   *  `today` workout is a day-1 snapshot, not today's session. */
  sitrepStale: boolean;
  /** Consecutive-day completed-workout streak, computed LIVE from
   *  op.workouts up to `today` — never read from the frozen dailyBrief. */
  streakDays: number;
  nutritionTargets: MacroTargets | undefined;
  workoutDates: string[];
  nutritionDates: string[];
  prCount: number;
  injuryCount: number;
}

function readDateField(blob: unknown, key: string): string | null {
  if (!blob || typeof blob !== 'object') return null;
  const v = (blob as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : null;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Consecutive-day completed-workout streak ending at `today`. */
function computeStreak(workouts: Record<string, Workout>, today?: string): number {
  if (!today) return 0;
  const d = new Date(today + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return 0;
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const w = workouts[isoDay(d)] as { completed?: boolean } | undefined;
    if (w?.completed) streak++;
    else if (i > 0) break; // a gap before today ends the streak (today itself may still be pending)
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/**
 * Project the operator into the compact profile summary the MCP read
 * tools return. Pass `today` (operator-local YYYY-MM-DD) to enable the
 * freshness guard: a `dailyBrief`/`sitrep` dated before today is a stale
 * cached generation, so we drop the brief and flag the sitrep rather
 * than letting Gunny coach off weeks-old numbers (wrong split,
 * streakDays:0, stale calories) while get_today_workout has live truth.
 */
export function projectProfileSummary(
  op: Operator,
  opts: { today?: string } = {},
): ProfileSummary {
  const today = opts.today;
  const workouts = (op.workouts || {}) as Record<string, Workout>;

  const briefDate = readDateField(op.dailyBrief, 'date');
  const dailyBriefStale = !!today && !!briefDate && briefDate !== today;

  const sitrepDate = readDateField(op.sitrep, 'generatedDate');
  const sitrepStale = !!today && !!sitrepDate && sitrepDate !== today;

  return {
    id: op.id,
    callsign: op.callsign,
    name: op.name,
    intake: op.intake,
    profile: op.profile,
    preferences: op.preferences,
    sitrep: op.sitrep,
    // Drop a stale brief entirely — a null brief makes Gunny fall back
    // to get_today_workout / live data instead of trusting frozen output.
    dailyBrief: dailyBriefStale ? null : op.dailyBrief,
    dailyBriefStale,
    sitrepStale,
    streakDays: computeStreak(workouts, today),
    nutritionTargets: op.nutrition?.targets,
    workoutDates: Object.keys(op.workouts || {}).sort(),
    nutritionDates: Object.keys(op.nutrition?.meals || {}).sort(),
    prCount: (op.prs || []).length,
    injuryCount: (op.injuries || []).length,
  };
}
