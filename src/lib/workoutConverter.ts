import { SitrepDay, Workout, ExerciseBlock } from '@/lib/types';

/**
 * Convert a SitrepDay (from SITREP or DailyBrief) into a Planner Workout.
 * This lets users "load" AI-generated workouts into their calendar.
 */
export function sitrepDayToWorkout(day: SitrepDay, dateStr: string): Workout {
  const blocks: ExerciseBlock[] = (day.exercises || []).map((ex, i) => ({
    type: 'exercise' as const,
    id: `block-${dateStr}-${i}`,
    sortOrder: i,
    exerciseName: ex.name,
    prescription: formatPrescription(ex),
    isLinkedToNext: !!ex.superset,
  }));

  return {
    id: `workout-${dateStr}-${Date.now()}`,
    date: dateStr,
    title: day.title || `Day ${day.dayNumber} — ${day.dayName}`,
    notes: day.notes || '',
    warmup: day.warmup || '',
    blocks,
    cooldown: day.cooldown || '',
    completed: false,
  };
}

function formatPrescription(ex: { sets: number; reps: string; weight?: string; rest?: string; notes?: string }): string {
  let rx = `${ex.sets}x${ex.reps}`;
  if (ex.weight) rx += ` @ ${ex.weight}`;
  if (ex.rest) rx += ` | Rest: ${ex.rest}`;
  if (ex.notes) rx += ` — ${ex.notes}`;
  return rx;
}
