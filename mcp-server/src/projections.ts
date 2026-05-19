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
  nutritionTargets: MacroTargets | undefined;
  workoutDates: string[];
  nutritionDates: string[];
  prCount: number;
  injuryCount: number;
}

export function projectProfileSummary(op: Operator): ProfileSummary {
  return {
    id: op.id,
    callsign: op.callsign,
    name: op.name,
    intake: op.intake,
    profile: op.profile,
    preferences: op.preferences,
    sitrep: op.sitrep,
    dailyBrief: op.dailyBrief,
    nutritionTargets: op.nutrition?.targets,
    workoutDates: Object.keys(op.workouts || {}).sort(),
    nutritionDates: Object.keys(op.nutrition?.meals || {}).sort(),
    prCount: (op.prs || []).length,
    injuryCount: (op.injuries || []).length,
  };
}
