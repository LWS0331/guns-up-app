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

// ───────────────────────────────────────────────────────────────────
// WS4 (May 2026) — structured analysis for the post-workout debrief UI
//
// The buildWorkoutAnalysis() function above produces a TEXT block for
// Gunny's context injection (server-side prompt). The structured
// variants below return DATA so the completion-screen UI can render
// per-exercise cards with progress badges + adherence breakdown.
//
// Why a separate path: rendering UI from a multi-section text block
// would require fragile parsing. Keep one source of truth per
// concern — text for the LLM, structured for the UI — both reading
// from the same Workout + Operator shape.
// ───────────────────────────────────────────────────────────────────

import type { ExerciseBlock, SetResult } from './types';

export interface TopSet {
  weight: number;
  reps: number;
}

export interface ExerciseComparison {
  exerciseName: string;
  /** Top set in TODAY's session (highest weight*reps among completed). */
  today: TopSet | null;
  /** Top set in the most recent prior session that had this exercise. */
  prior: TopSet | null;
  /** Date YYYY-MM-DD of the prior session, when found. */
  priorDate: string | null;
  /** Verbal delta — what to show on the chip ("+5 lbs", "matched", etc.). */
  label: string;
  /** Color hint for the chip. */
  color: 'up' | 'same' | 'down' | 'neutral';
  /** Numeric weight delta. null when prior missing. */
  weightDelta: number | null;
  /** Numeric reps delta. */
  repsDelta: number | null;
}

export interface AdherenceRow {
  exerciseName: string;
  setsCompleted: number;
  setsPrescribed: number;
  /** 0-100, capped. */
  completionPct: number;
}

export interface SessionAnalysis {
  comparisons: ExerciseComparison[];
  adherence: AdherenceRow[];
  /** Total weight × reps across all completed sets in this session. */
  tonnageLbs: number;
  /** Count of exercises where today beat the prior session. */
  exercisesUp: number;
  /** Count of exercises where today regressed. */
  exercisesDown: number;
  /** Count of exercises that hit "first time logged" status. */
  firstTimeCount: number;
}

/** Highest weight*reps among completed sets. Null when none completed. */
function topCompletedSet(sets: SetResult[] | undefined): TopSet | null {
  if (!sets || sets.length === 0) return null;
  let best: TopSet | null = null;
  for (const s of sets) {
    if (!s.completed) continue;
    const w = typeof s.weight === 'number' ? s.weight : 0;
    const r = typeof s.reps === 'number' ? s.reps : 0;
    if (w <= 0 && r <= 0) continue;
    if (!best) {
      best = { weight: w, reps: r };
      continue;
    }
    const cur = w * r;
    const prevScore = best.weight * best.reps;
    if (cur > prevScore || (cur === prevScore && w > best.weight)) {
      best = { weight: w, reps: r };
    }
  }
  return best;
}

/** Parse "Nx..." from a prescription to get the prescribed set count.
 *  Returns null when no leading "Nx" is found. */
function prescribedSetCount(prescription: string | undefined): number | null {
  if (!prescription) return null;
  const m = prescription.match(/^\s*(\d{1,2})\s*x/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0 || n > 50) return null;
  return n;
}

function exerciseNameMatches(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** Walk operator.workouts backward by date to find the most recent
 *  completed prior workout that has this exercise with at least one
 *  completed set. */
function findPriorTopSet(
  operator: Operator,
  exerciseName: string,
  excludeDate: string,
): { topSet: TopSet; date: string } | null {
  const dates = Object.keys(operator.workouts || {})
    .filter((d) => d !== excludeDate)
    .sort((a, b) => b.localeCompare(a)); // newest first
  for (const date of dates) {
    const w = operator.workouts[date];
    if (!w || !w.completed) continue;
    const block = (w.blocks || []).find(
      (b): b is ExerciseBlock =>
        b.type === 'exercise' &&
        exerciseNameMatches((b as ExerciseBlock).exerciseName, exerciseName),
    );
    if (!block) continue;
    const sets = w.results?.blockResults?.[block.id]?.sets;
    const top = topCompletedSet(sets);
    if (top) return { topSet: top, date };
  }
  return null;
}

function deltaLabel(
  today: TopSet | null,
  prior: TopSet | null,
): Pick<ExerciseComparison, 'label' | 'color' | 'weightDelta' | 'repsDelta'> {
  if (!today) {
    return { label: 'not logged', color: 'neutral', weightDelta: null, repsDelta: null };
  }
  if (!prior) {
    return { label: 'first time logged', color: 'neutral', weightDelta: null, repsDelta: null };
  }
  const wDelta = today.weight - prior.weight;
  const rDelta = today.reps - prior.reps;
  if (wDelta > 0) {
    return {
      label: `+${wDelta} lbs${rDelta !== 0 ? ` · ${rDelta > 0 ? '+' : ''}${rDelta} reps` : ''}`,
      color: 'up',
      weightDelta: wDelta,
      repsDelta: rDelta,
    };
  }
  if (wDelta < 0) {
    return {
      label: `${wDelta} lbs${rDelta !== 0 ? ` · ${rDelta > 0 ? '+' : ''}${rDelta} reps` : ''}`,
      color: 'down',
      weightDelta: wDelta,
      repsDelta: rDelta,
    };
  }
  if (rDelta > 0) {
    return { label: `same weight, +${rDelta} reps`, color: 'up', weightDelta: 0, repsDelta: rDelta };
  }
  if (rDelta < 0) {
    return { label: `same weight, ${rDelta} reps`, color: 'down', weightDelta: 0, repsDelta: rDelta };
  }
  return { label: 'matched last session', color: 'same', weightDelta: 0, repsDelta: 0 };
}

/** End-to-end analysis for the post-workout completion overlay. The
 *  caller MUST have already persisted the workout (so operator.workouts
 *  contains it) — dedup uses workout.date. */
export function computeSessionAnalysis(workout: Workout, operator: Operator): SessionAnalysis {
  const comparisons: ExerciseComparison[] = [];
  const adherence: AdherenceRow[] = [];
  let tonnage = 0;
  let up = 0;
  let down = 0;
  let firstTime = 0;

  for (const block of workout.blocks || []) {
    if (block.type !== 'exercise') continue;
    const ex = block as ExerciseBlock;
    const sets = workout.results?.blockResults?.[ex.id]?.sets || [];
    const completed = sets.filter((s) => s.completed).length;
    const prescribed = prescribedSetCount(ex.prescription) ?? sets.length ?? 0;
    const pct =
      prescribed > 0 ? Math.min(100, Math.round((completed / prescribed) * 100)) : 0;
    adherence.push({
      exerciseName: ex.exerciseName,
      setsCompleted: completed,
      setsPrescribed: prescribed,
      completionPct: pct,
    });

    // Tonnage — every completed set, even non-top, contributes.
    for (const s of sets) {
      if (!s.completed) continue;
      const w = typeof s.weight === 'number' ? s.weight : 0;
      const r = typeof s.reps === 'number' ? s.reps : 0;
      tonnage += w * r;
    }

    const todayTop = topCompletedSet(sets);
    const priorMatch = findPriorTopSet(operator, ex.exerciseName, workout.date);
    const { label, color, weightDelta, repsDelta } = deltaLabel(
      todayTop,
      priorMatch?.topSet || null,
    );
    if (color === 'up') up++;
    if (color === 'down') down++;
    if (!priorMatch && todayTop) firstTime++;
    comparisons.push({
      exerciseName: ex.exerciseName,
      today: todayTop,
      prior: priorMatch?.topSet || null,
      priorDate: priorMatch?.date || null,
      label,
      color,
      weightDelta,
      repsDelta,
    });
  }

  return {
    comparisons,
    adherence,
    tonnageLbs: tonnage,
    exercisesUp: up,
    exercisesDown: down,
    firstTimeCount: firstTime,
  };
}
