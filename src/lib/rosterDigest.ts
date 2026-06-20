// Roster digest — the head-trainer's upward roll-up.
//
// One compact row per operator: streak, 7-day compliance, last completed
// workout, latest readiness check-in, and plan status (head-trainer
// takeover / stale / diverged). Reuses the same live-stat helpers the app
// and MCP already use so the numbers match what the operator sees. Pure
// (no DB) so it's unit-testable; the route maps it over all operators.

import type { Operator } from './types';
import { computeWorkoutStreak, computeCompliance } from './workoutStats';
import { isPlanLocked } from './planOverride';
import { detectSitrepDivergence, isSitrepStale } from './sitrepFreshness';

export interface RosterDigestEntry {
  id: string;
  callsign: string | null;
  name: string | null;
  /** Consecutive-day completed-workout streak ending today. */
  streakDays: number;
  /** Completed/scheduled % over the trailing 7 days, or null. */
  compliance7d: number | null;
  /** Most recent completed-workout date (YYYY-MM-DD), or null. */
  lastWorkoutDate: string | null;
  /** Latest daily readiness check-in, or null. */
  latestReadiness: { date: string; readiness?: number; sleep?: number; stress?: number } | null;
  /** True when a head trainer has taken over this operator's plan. */
  planManaged: boolean;
  /** True when the sitrep was generated on an earlier day (not managed). */
  sitrepStale: boolean;
  /** True when the stored plan diverged from current preferences. */
  diverged: boolean;
}

type ReadinessEntry = { readiness?: number; sleep?: number; stress?: number };

/** Build one digest row for an operator as of `today` (operator-local). */
export function buildRosterDigestEntry(op: Operator, today: string): RosterDigestEntry {
  const workouts = (op.workouts || {}) as Record<string, { completed?: boolean }>;
  const completedDates = Object.entries(workouts)
    .filter(([, w]) => w?.completed)
    .map(([d]) => d)
    .sort();

  const dr = (op.dailyReadiness || {}) as Record<string, ReadinessEntry>;
  const readinessDates = Object.keys(dr).sort();
  const lastReadinessDate = readinessDates[readinessDates.length - 1];
  const rEntry = lastReadinessDate ? dr[lastReadinessDate] : undefined;

  const managed = isPlanLocked(op);

  return {
    id: op.id,
    callsign: op.callsign ?? null,
    name: op.name ?? null,
    streakDays: computeWorkoutStreak(workouts, today),
    compliance7d: computeCompliance(workouts, today),
    lastWorkoutDate: completedDates[completedDates.length - 1] ?? null,
    latestReadiness: rEntry
      ? { date: lastReadinessDate, readiness: rEntry.readiness, sleep: rEntry.sleep, stress: rEntry.stress }
      : null,
    planManaged: managed,
    // A managed plan is intentionally frozen — don't report it as "stale".
    sitrepStale: managed ? false : isSitrepStale(op, today),
    diverged: managed ? false : detectSitrepDivergence(op).diverged,
  };
}

/** Build the full roster digest, sorted most-recently-active first. */
export function buildRosterDigest(operators: Operator[], today: string): RosterDigestEntry[] {
  return operators
    .map((op) => buildRosterDigestEntry(op, today))
    .sort((a, b) => (b.lastWorkoutDate || '').localeCompare(a.lastWorkoutDate || ''));
}
