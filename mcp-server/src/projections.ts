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
  /** Head-trainer who has taken over this operator's daily plan, or null.
   *  When set, the plan is trainer-managed: staleness flags are forced
   *  false and the brief is kept as-authored (no auto-refresh). */
  planManagedBy: string | null;
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

/**
 * Normalize a stored date string to a Pacific calendar day (YYYY-MM-DD),
 * matching how `today` (todayKey) and dailyBrief.date are produced.
 *
 * A bare YYYY-MM-DD passes through unchanged; a full ISO timestamp
 * (e.g. sitrep.generatedDate = new Date().toISOString()) is converted
 * from its instant to the Pacific calendar date so the staleness check
 * compares day-to-day, not timestamp-to-day. Returns null if unparseable.
 *
 * Without this, `sitrepStale` was ALWAYS true: a full ISO timestamp like
 * '2026-06-19T08:30:00.000Z' never equals the 'YYYY-MM-DD' `today` key,
 * so even a sitrep generated minutes ago read as stale.
 */
function toPacificDay(s: string | null): string | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** dayTag colors that mark a *scheduled* rest and so bridge the streak
 *  (cyan = rest day, amber = deload, red = injured/sick). Mirrors
 *  REST_TAG_COLORS in src/lib/workoutStats.ts (separate package). */
const REST_TAG_COLORS = new Set(['cyan', 'amber', 'red']);

/**
 * Consecutive-day completed-workout streak ending at `today`. A scheduled
 * rest day (cyan/amber/red dayTag) bridges the streak without incrementing
 * it; an untracked gap or a past missed workout still ends it. Mirrors
 * computeWorkoutStreak in src/lib/workoutStats.ts.
 */
function computeStreak(
  workouts: Record<string, Workout>,
  today?: string,
  dayTags?: Record<string, { color?: string }>,
): number {
  if (!today) return 0;
  const tags = dayTags || {};
  const d = new Date(today + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return 0;
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const key = isoDay(d);
    const w = workouts[key] as { completed?: boolean } | undefined;
    if (w?.completed) {
      streak++;
    } else if (REST_TAG_COLORS.has(tags[key]?.color ?? '')) {
      // scheduled rest — bridge without incrementing
    } else if (i > 0) {
      break; // a gap before today ends the streak (today itself may still be pending)
    }
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

  // Head-trainer takeover: when the plan is locked, it's trainer-managed —
  // never flag it stale or drop the brief (the trainer authored it on
  // purpose; auto-refresh is suppressed).
  const ov = op.planOverride;
  const planManaged = !!ov && typeof ov === 'object' && (ov as { active?: unknown }).active === true;
  const planManagedBy = planManaged ? ((ov as { lockedBy?: string }).lockedBy || 'head_trainer') : null;

  const briefDate = toPacificDay(readDateField(op.dailyBrief, 'date'));
  const dailyBriefStale = !planManaged && !!today && !!briefDate && briefDate !== today;

  // sitrep.generatedDate is a full ISO timestamp; normalize to the Pacific
  // calendar day before comparing or every sitrep reads as stale.
  const sitrepDate = toPacificDay(readDateField(op.sitrep, 'generatedDate'));
  const sitrepStale = !planManaged && !!today && !!sitrepDate && sitrepDate !== today;

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
    streakDays: computeStreak(workouts, today, op.dayTags as Record<string, { color?: string }> | undefined),
    planManagedBy,
    nutritionTargets: op.nutrition?.targets,
    workoutDates: Object.keys(op.workouts || {}).sort(),
    nutritionDates: Object.keys(op.nutrition?.meals || {}).sort(),
    prCount: (op.prs || []).length,
    injuryCount: (op.injuries || []).length,
  };
}
