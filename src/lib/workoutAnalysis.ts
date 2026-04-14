// Workout Analysis Utility — builds a rich analysis string from a completed
// workout for injection into Gunny's context block.
//
// Used by both GunnyChat.tsx and AppShell.tsx to give Gunny specific,
// number-grounded visibility into the operator's actual logged performance
// so post-workout SITREPs reference real data (volume, completion %, PRs)
// instead of generic "great job" responses.

import type { Workout, PRRecord, Operator } from './types';

interface ExerciseRow {
  name: string;
  planned: string;
  actual: string;
  volume: number;
  completionRate: string;
  isPR: boolean;
  prDelta?: number;
  notes?: string;
}

/**
 * Build a human-readable analysis block for a single completed workout.
 * Returns empty string if the workout isn't completed or has no results.
 */
export function buildWorkoutAnalysis(
  workout: Workout | undefined,
  operatorPRs: PRRecord[] = [],
  allWorkouts: Record<string, Workout> = {}
): string {
  if (!workout || !workout.results || !workout.completed) return '';

  const lines: string[] = [];
  lines.push('═══ COMPLETED WORKOUT ANALYSIS ═══');
  lines.push(`Title: ${workout.title || 'Untitled'}`);
  lines.push(`Date: ${workout.date}`);

  // Duration
  const { startTime, endTime, blockResults } = workout.results;
  if (startTime && endTime) {
    const mins = Math.round(
      (new Date(endTime).getTime() - new Date(startTime).getTime()) / 60000
    );
    if (!isNaN(mins) && mins > 0 && mins < 600) {
      lines.push(`Duration: ${mins} minutes`);
    }
  }

  let totalVolume = 0;
  let totalSets = 0;
  let completedSets = 0;
  const rows: ExerciseRow[] = [];

  workout.blocks?.forEach(block => {
    if (block.type !== 'exercise') return;
    const result = blockResults?.[block.id];
    if (!result) return;
    const sets = result.sets || [];
    totalSets += sets.length;
    const done = sets.filter(s => s.completed);
    completedSets += done.length;

    const volume = done.reduce(
      (sum, s) => sum + ((s.weight || 0) * (s.reps || 0)),
      0
    );
    totalVolume += volume;

    const maxWeight = done.length
      ? Math.max(...done.map(s => s.weight || 0))
      : 0;

    const existingPR = operatorPRs.find(
      pr => pr.exercise?.toLowerCase() === block.exerciseName?.toLowerCase()
    );
    const isPR = existingPR ? maxWeight > existingPR.weight : maxWeight > 0 && done.length > 0;
    const prDelta = existingPR && isPR ? maxWeight - existingPR.weight : undefined;

    rows.push({
      name: block.exerciseName || 'Exercise',
      planned: block.prescription || '',
      actual: done.map(s => `${s.weight || 0}x${s.reps || 0}`).join(', ') || 'no sets logged',
      volume,
      completionRate: `${done.length}/${sets.length}`,
      isPR,
      prDelta,
      notes: result.notes || undefined,
    });
  });

  const completionPct = totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  lines.push('');
  lines.push(`Completion: ${completedSets}/${totalSets} sets (${completionPct}%)`);
  lines.push(`Total Volume: ${totalVolume.toLocaleString()} lbs`);

  // Per-exercise breakdown
  rows.forEach(r => {
    lines.push('');
    lines.push(`${r.name}:`);
    lines.push(`  Planned: ${r.planned}`);
    lines.push(`  Actual: ${r.actual}`);
    lines.push(`  Volume: ${r.volume.toLocaleString()} lbs`);
    lines.push(`  Sets: ${r.completionRate}`);
    if (r.isPR) {
      lines.push(r.prDelta !== undefined
        ? `  *** NEW PR *** (+${r.prDelta} lbs)`
        : `  *** NEW PR ***`);
    }
    if (r.notes) lines.push(`  Notes: ${r.notes}`);
  });

  // Compare to most recent previous workout with same title
  const prior = findPreviousSimilar(workout, allWorkouts);
  if (prior) {
    const priorVolume = calcVolume(prior);
    if (priorVolume > 0) {
      const delta = totalVolume - priorVolume;
      const pctChange = priorVolume > 0 ? Math.round((delta / priorVolume) * 100) : 0;
      lines.push('');
      lines.push(`Progressive overload vs last "${prior.title}" (${prior.date}):`);
      lines.push(`  Previous volume: ${priorVolume.toLocaleString()} lbs`);
      lines.push(`  Current volume: ${totalVolume.toLocaleString()} lbs`);
      lines.push(`  Change: ${delta >= 0 ? '+' : ''}${delta.toLocaleString()} lbs (${pctChange >= 0 ? '+' : ''}${pctChange}%)`);
    }
  }

  return lines.join('\n');
}

/** Find the most recent completed workout with the same title (before this one). */
function findPreviousSimilar(
  current: Workout,
  allWorkouts: Record<string, Workout>
): Workout | null {
  const entries = Object.entries(allWorkouts)
    .filter(([, w]) => w && w.completed && w.results && w.title === current.title && w.date !== current.date)
    .sort(([a], [b]) => b.localeCompare(a));
  if (!entries.length) return null;
  return entries[0][1];
}

/** Sum total volume (weight * reps for completed sets) across a workout. */
function calcVolume(w: Workout): number {
  if (!w.results?.blockResults) return 0;
  let v = 0;
  Object.values(w.results.blockResults).forEach(br => {
    (br.sets || []).forEach(s => {
      if (s.completed) v += (s.weight || 0) * (s.reps || 0);
    });
  });
  return v;
}

/**
 * Find the most recent completed workout for an operator, scanning today
 * backwards. Returns undefined if no completed workout exists.
 */
export function findMostRecentCompletedWorkout(op: Operator): Workout | undefined {
  const workouts = op.workouts || {};
  const dates = Object.keys(workouts).sort().reverse();
  for (const d of dates) {
    const w = workouts[d];
    if (w?.completed && w?.results) return w;
  }
  return undefined;
}
