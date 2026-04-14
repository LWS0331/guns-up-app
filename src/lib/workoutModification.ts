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
  | ReorderBlocksMod;

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

    default:
      return workout;
  }

  updated.blocks = blocks;
  // CRITICAL: do NOT touch updated.results — preserve logged data
  return updated;
}
