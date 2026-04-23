// Surgical workout modification helper.
// Takes a Workout and a modification descriptor from Gunny AI, returns a
// NEW Workout with the change applied. Does NOT touch workout.results —
// all logged sets/weights are preserved.

import type { Workout, WorkoutBlock, ExerciseBlock } from './types';

export type WorkoutModification =
  | SwapExerciseMod
  | AddBlockMod
  | RemoveBlockMod
  | UpdatePrescriptionMod
  | ReorderBlocksMod
  | PrefillWeightsMod;

export interface SwapExerciseMod {
  type: 'swap_exercise';
  targetBlockId?: string;
  targetExerciseName?: string;
  changes: {
    exerciseName?: string;
    prescription?: string;
    videoUrl?: string;
  };
}

export interface AddBlockMod {
  type: 'add_block';
  afterBlockId?: string;
  afterExerciseName?: string;
  newBlock: Partial<WorkoutBlock> & { type: 'exercise' | 'conditioning' };
}

export interface RemoveBlockMod {
  type: 'remove_block';
  targetBlockId?: string;
  targetExerciseName?: string;
}

export interface UpdatePrescriptionMod {
  type: 'update_prescription';
  targetBlockId?: string;
  targetExerciseName?: string;
  changes: { prescription?: string; exerciseName?: string };
}

export interface ReorderBlocksMod {
  type: 'reorder_blocks';
  newOrder: string[];
}

/**
 * Pre-fill the weights (and optionally reps) for an exercise in the ACTIVE
 * workout-mode execution. Unlike the other mods, this does NOT change the
 * workout's blocks — it writes to the live `workoutResults` state so the user
 * sees numbers populate in the set inputs as they're watching.
 *
 * Emitted by Gunny when the user asks things like "fill in my bench weights
 * from last week" or "prefill from my last leg day." Handled via a
 * CustomEvent bridge (see workoutEvents.ts) rather than applyWorkoutModification
 * because the persisted Workout object isn't the target — the Planner's
 * in-memory live state is.
 */
export interface PrefillWeightsMod {
  type: 'prefill_weights';
  targetBlockId?: string;
  targetExerciseName?: string;  // e.g. "Bench Press" — matched case-insensitively
  sets: Array<{ weight: number; reps?: number }>;
  // Short human-readable provenance string, shown to the user as a toast so
  // they can verify what Gunny pulled. e.g. "from last Monday's push day".
  sourceLabel?: string;
}

/** Case-insensitive block finder by id-or-name. */
function findBlockIndex(
  blocks: WorkoutBlock[],
  byId?: string,
  byName?: string
): number {
  if (byId) {
    const i = blocks.findIndex(b => b.id === byId);
    if (i !== -1) return i;
  }
  if (byName) {
    const lowered = byName.toLowerCase().trim();
    return blocks.findIndex(
      b => b.type === 'exercise' &&
           (b as ExerciseBlock).exerciseName?.toLowerCase().trim() === lowered
    );
  }
  return -1;
}

/**
 * Apply a surgical modification to a workout.
 * Returns a NEW workout object. Caller must persist the result.
 */
export function applyWorkoutModification(
  workout: Workout,
  mod: WorkoutModification
): Workout {
  const updated: Workout = { ...workout };
  let blocks: WorkoutBlock[] = [...(updated.blocks || [])];

  switch (mod.type) {
    case 'swap_exercise': {
      const idx = findBlockIndex(blocks, mod.targetBlockId, mod.targetExerciseName);
      if (idx !== -1 && blocks[idx].type === 'exercise') {
        const old = blocks[idx] as ExerciseBlock;
        const merged: ExerciseBlock = {
          ...old,
          exerciseName: mod.changes.exerciseName ?? old.exerciseName,
          prescription: mod.changes.prescription ?? old.prescription,
          videoUrl: mod.changes.videoUrl ?? old.videoUrl,
          id: old.id, // PRESERVE original block ID so logged results still map
          sortOrder: old.sortOrder,
          isLinkedToNext: old.isLinkedToNext,
          type: 'exercise',
        };
        blocks[idx] = merged;
      }
      break;
    }

    case 'add_block': {
      let afterIdx = -1;
      if (mod.afterBlockId) afterIdx = blocks.findIndex(b => b.id === mod.afterBlockId);
      if (afterIdx === -1 && mod.afterExerciseName) {
        const lowered = mod.afterExerciseName.toLowerCase().trim();
        afterIdx = blocks.findIndex(
          b => b.type === 'exercise' &&
               (b as ExerciseBlock).exerciseName?.toLowerCase().trim() === lowered
        );
      }
      const insertAt = afterIdx === -1 ? blocks.length : afterIdx + 1;
      const newId = `block-mod-${Date.now()}`;
      const base = mod.newBlock || ({} as Partial<WorkoutBlock>);
      let newBlock: WorkoutBlock;
      if (base.type === 'conditioning') {
        newBlock = {
          type: 'conditioning',
          id: newId,
          sortOrder: insertAt,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          format: (base as any).format || '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          description: (base as any).description || '',
          isLinkedToNext: false,
        };
      } else {
        newBlock = {
          type: 'exercise',
          id: newId,
          sortOrder: insertAt,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          exerciseName: (base as any).exerciseName || 'New Exercise',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          prescription: (base as any).prescription || '',
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          videoUrl: (base as any).videoUrl,
          isLinkedToNext: false,
        };
      }
      blocks.splice(insertAt, 0, newBlock);
      // Recompute sortOrder so UI ordering stays consistent
      blocks = blocks.map((b, i) => ({ ...b, sortOrder: i }));
      break;
    }

    case 'remove_block': {
      const lowered = mod.targetExerciseName?.toLowerCase().trim();
      blocks = blocks.filter(b => {
        if (mod.targetBlockId && b.id === mod.targetBlockId) return false;
        if (lowered && b.type === 'exercise' &&
            (b as ExerciseBlock).exerciseName?.toLowerCase().trim() === lowered) return false;
        return true;
      });
      blocks = blocks.map((b, i) => ({ ...b, sortOrder: i }));
      break;
    }

    case 'update_prescription': {
      const idx = findBlockIndex(blocks, mod.targetBlockId, mod.targetExerciseName);
      if (idx !== -1 && blocks[idx].type === 'exercise') {
        const old = blocks[idx] as ExerciseBlock;
        blocks[idx] = {
          ...old,
          prescription: mod.changes.prescription ?? old.prescription,
          exerciseName: mod.changes.exerciseName ?? old.exerciseName,
        };
      }
      break;
    }

    case 'reorder_blocks': {
      const byId = new Map(blocks.map(b => [b.id, b]));
      const reordered: WorkoutBlock[] = [];
      mod.newOrder.forEach(id => {
        const b = byId.get(id);
        if (b) { reordered.push(b); byId.delete(id); }
      });
      // Append any blocks not referenced in the new order at the end
      byId.forEach(b => reordered.push(b));
      blocks = reordered.map((b, i) => ({ ...b, sortOrder: i }));
      break;
    }

    case 'prefill_weights': {
      // Not this function's job — the live results state is owned by Planner,
      // not the persisted Workout. Callers must route prefill_weights via
      // workoutEvents.dispatchPrefillWeights() and let Planner's listener
      // patch workoutResults directly. Returning the workout unchanged here
      // just means we're a no-op for this mod type at the workout level.
      return workout;
    }

    default:
      return workout;
  }

  updated.blocks = blocks;
  // CRITICAL: do NOT touch updated.results — preserve logged data
  return updated;
}
