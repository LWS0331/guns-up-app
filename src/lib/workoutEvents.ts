// Event bridge for workout-mode live updates driven by Gunny AI.
//
// The Planner component owns the live workout execution state (current sets,
// weights, reps, notes) as local React state. When Gunny emits a
// `prefill_weights` modification during a chat turn, we need to deliver the
// new numbers to Planner WITHOUT lifting that state up to the app root — the
// persisted `operator.workouts[date].results` object isn't the right target
// because the user hasn't committed the set yet, they're watching numbers
// populate so they can tweak and log.
//
// A DOM CustomEvent is a pragmatic cross-component channel: Planner subscribes
// only while workout mode is active, Gunny handlers in AppShell / GunnyChat
// dispatch without needing a prop chain, and there's no global store to
// coordinate. Event-driven, one direction, easy to reason about.

import type { PrefillWeightsMod } from './workoutModification';

export const GUNNY_PREFILL_WEIGHTS_EVENT = 'gunny:prefill-weights';

export interface PrefillWeightsDetail {
  /** Block id (if Gunny knew it) or null — listener falls back to exerciseName match. */
  targetBlockId: string | null;
  /** Exercise name Gunny picked. Case-insensitive match against the active workout's blocks. */
  targetExerciseName: string | null;
  /** Sets to write. Weight required; reps optional (some prefills want just weight nudges). */
  sets: Array<{ weight: number; reps?: number }>;
  /** Optional "from last Monday's push day" label the listener can toast. */
  sourceLabel?: string;
}

/** Dispatch a prefill-weights update. Safe to call server-side (no-op). */
export function dispatchPrefillWeights(mod: PrefillWeightsMod): void {
  if (typeof window === 'undefined') return;
  const detail: PrefillWeightsDetail = {
    targetBlockId: mod.targetBlockId || null,
    targetExerciseName: mod.targetExerciseName || null,
    sets: Array.isArray(mod.sets) ? mod.sets : [],
    sourceLabel: mod.sourceLabel,
  };
  try {
    window.dispatchEvent(new CustomEvent(GUNNY_PREFILL_WEIGHTS_EVENT, { detail }));
  } catch (err) {
    console.warn('[workoutEvents] dispatchPrefillWeights failed:', err);
  }
}

/**
 * Subscribe to prefill-weights events. Returns an unsubscribe function.
 * Planner only attaches this while workoutMode is active.
 */
export function onPrefillWeights(
  cb: (detail: PrefillWeightsDetail) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: Event) => {
    const detail = (e as CustomEvent<PrefillWeightsDetail>).detail;
    if (detail) cb(detail);
  };
  window.addEventListener(GUNNY_PREFILL_WEIGHTS_EVENT, handler);
  return () => window.removeEventListener(GUNNY_PREFILL_WEIGHTS_EVENT, handler);
}
