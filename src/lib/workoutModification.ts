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
  | SetFieldsMod
  | PrefillWeightsMod;

// Optional explicit-date hint emitted by Gunny when the operator names
// a specific day ("add squats to Saturday's workout", "swap that
// exercise on Monday"). When present, callers MUST resolve the
// modification against this date and MUST NOT walk back to "the most
// recent workout" — that fallback was misrouting day-specific asks
// onto unrelated completed sessions (May 1 bug: "add to Saturday"
// landed on Friday's completed workout).
//
// YYYY-MM-DD in the operator's local timezone. Omit for mid-workout
// asks ("swap that exercise") which default to today.
export interface DateScopedMod {
  targetDate?: string;
}

export interface SwapExerciseMod extends DateScopedMod {
  type: 'swap_exercise';
  targetBlockId?: string;
  targetExerciseName?: string;
  changes: {
    exerciseName?: string;
    prescription?: string;
    videoUrl?: string;
  };
}

export interface AddBlockMod extends DateScopedMod {
  type: 'add_block';
  afterBlockId?: string;
  afterExerciseName?: string;
  newBlock: Partial<WorkoutBlock> & { type: 'exercise' | 'conditioning' };
}

export interface RemoveBlockMod extends DateScopedMod {
  type: 'remove_block';
  targetBlockId?: string;
  targetExerciseName?: string;
}

export interface UpdatePrescriptionMod extends DateScopedMod {
  type: 'update_prescription';
  targetBlockId?: string;
  targetExerciseName?: string;
  changes: { prescription?: string; exerciseName?: string };
}

export interface ReorderBlocksMod extends DateScopedMod {
  type: 'reorder_blocks';
  newOrder: string[];
}

/**
 * Patch workout-level metadata (notes, title, warmup, cooldown, completed,
 * sessionRpe, sessionDurationMin, primer) WITHOUT touching `blocks` or
 * `results`. The only previous path that could write these fields was
 * add_or_update_workout, which does a full-day replace and wipes the
 * logged sets — so stamping an Apple Watch summary onto a completed
 * session destroyed the set log. set_fields is the surgical, results-
 * preserving counterpart for metadata edits. Bug filed 2026-06-02
 * (RAMPAGE).
 *
 * Only the keys passed in `fields` are written; absent keys are left
 * intact (no implicit clears). `blocks`, `results`, `id`, and `date`
 * are NEVER writable via this mod — use add_or_update_workout to
 * replace blocks, the in-app planner UI to capture results, and the
 * persistence layer's identity is anchored on date so it can't move.
 */
export interface SetFieldsMod extends DateScopedMod {
  type: 'set_fields';
  fields: {
    title?: string;
    notes?: string;
    warmup?: string;
    primer?: string;
    cooldown?: string;
    completed?: boolean;
    sessionRpe?: number;
    sessionDurationMin?: number;
  };
}

/** Runtime allowlist for set_fields. Mirrors SetFieldsMod['fields'] keys
 * exactly — single source of truth for what set_fields is permitted to
 * write. Anything not in this list (blocks, results, id, date, etc.)
 * is silently dropped by the handler. */
const SET_FIELDS_ALLOWED = [
  'title',
  'notes',
  'warmup',
  'primer',
  'cooldown',
  'completed',
  'sessionRpe',
  'sessionDurationMin',
] as const satisfies ReadonlyArray<keyof SetFieldsMod['fields']>;

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
 * Result of applying a workout modification.
 *
 * `changed` is the truthful "did this actually do anything?" flag.
 * Callers should branch on it to surface failures — Gunny may have
 * acknowledged the modification in the chat ("done, added it back!")
 * while the targeted block didn't exist, in which case the user sees
 * confirmation but no actual change. Without this flag those failures
 * were silently dropped.
 *
 * `reason` (when changed === false) carries a short developer-facing
 * label for logs / toasts: "block_not_found" | "no_op_for_type" |
 * "empty_payload".
 */
export interface ApplyWorkoutModificationResult {
  workout: Workout;
  changed: boolean;
  reason?: string;
}

/**
 * Apply a surgical modification to a workout.
 *
 * Returns { workout, changed, reason } so callers can detect silent
 * no-ops (e.g. Gunny emitted remove_block for "Bicep Curl" but the
 * workout has "Bicep Curls" — case-sensitive trim won't match, the
 * workout is returned unchanged, and without `changed === false` the
 * caller would persist an unchanged workout and Gunny's "done!" reply
 * would lie to the user).
 *
 * The legacy single-return-value signature is preserved via
 * applyWorkoutModificationLegacy for any callers that haven't been
 * updated yet, but the new shape is the canonical one — use it.
 */
export function applyWorkoutModification(
  workout: Workout,
  mod: WorkoutModification
): ApplyWorkoutModificationResult {
  const updated: Workout = { ...workout };
  let blocks: WorkoutBlock[] = [...(updated.blocks || [])];
  let changed = false;
  let reason: string | undefined;

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
        changed = true;
      } else {
        reason = `swap_exercise: no block matched id="${mod.targetBlockId ?? ''}" name="${mod.targetExerciseName ?? ''}"`;
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
      // add_block ALWAYS results in a change — even if afterIdx
      // matched nothing, we appended at the tail. So `changed` is
      // unconditionally true here. The afterIdx miss is logged as
      // info because it might not be what the operator expected.
      blocks.splice(insertAt, 0, newBlock);
      blocks = blocks.map((b, i) => ({ ...b, sortOrder: i }));
      changed = true;
      if (afterIdx === -1 && (mod.afterBlockId || mod.afterExerciseName)) {
        // Note we matched nothing on the anchor, even though the
        // insert succeeded at the tail — log so the caller can
        // optionally surface this as "added at the end" instead
        // of in the place the user expected.
        reason = `add_block: anchor not matched (afterBlockId="${mod.afterBlockId ?? ''}" afterExerciseName="${mod.afterExerciseName ?? ''}"); inserted at end of workout`;
      }
      break;
    }

    case 'remove_block': {
      const before = blocks.length;
      const lowered = mod.targetExerciseName?.toLowerCase().trim();
      blocks = blocks.filter(b => {
        if (mod.targetBlockId && b.id === mod.targetBlockId) return false;
        if (lowered && b.type === 'exercise' &&
            (b as ExerciseBlock).exerciseName?.toLowerCase().trim() === lowered) return false;
        return true;
      });
      if (blocks.length !== before) {
        blocks = blocks.map((b, i) => ({ ...b, sortOrder: i }));
        changed = true;
      } else {
        reason = `remove_block: no match for id="${mod.targetBlockId ?? ''}" name="${mod.targetExerciseName ?? ''}"`;
      }
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
        changed = true;
      } else {
        reason = `update_prescription: no block matched id="${mod.targetBlockId ?? ''}" name="${mod.targetExerciseName ?? ''}"`;
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
      changed = true;
      break;
    }

    case 'set_fields': {
      // Patch only the explicitly-supplied keys, and only the ones in
      // SET_FIELDS_ALLOWED. The upstream route doesn't validate the
      // inner shape of `fields` (it only gates on the outer `type`),
      // so without an allowlist a caller could smuggle `blocks: []`
      // or `results: null` and silently destroy the very data this
      // mod exists to preserve. Defense-in-depth.
      //
      // zod's .optional() leaves undefined entries present after parsing
      // — skip them so we never clear a field the caller didn't intend
      // to write.
      const fields = mod.fields || {};
      const written: string[] = [];
      for (const k of SET_FIELDS_ALLOWED) {
        const v = (fields as Record<string, unknown>)[k];
        if (v === undefined) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (updated as any)[k] = v;
        written.push(k);
      }
      if (written.length === 0) {
        return { workout, changed: false, reason: 'set_fields: empty payload' };
      }
      // We patched non-block metadata only — bypass the bottom-of-function
      // `updated.blocks = blocks` assignment by returning here. blocks
      // array on `updated` is untouched (spread from original above);
      // results never get touched at any point in this function.
      return { workout: updated, changed: true, reason: `set_fields: ${written.join(',')}` };
    }

    case 'prefill_weights': {
      // Not this function's job — the live results state is owned by
      // Planner, not the persisted Workout. Callers must route
      // prefill_weights via workoutEvents.dispatchPrefillWeights().
      // Returning unchanged here, with `changed: false`, communicates
      // that nothing was applied at the workout level — but in this
      // case "no change" is correct, not a failure.
      return { workout, changed: false, reason: 'prefill_weights handled by workoutEvents bridge, not this function' };
    }

    default:
      return { workout, changed: false, reason: 'unknown modification type' };
  }

  if (!changed) {
    // Safety net: if we got here without flipping `changed`, return
    // the original workout reference so React can shallow-compare and
    // skip a re-render.
    return { workout, changed: false, reason };
  }

  updated.blocks = blocks;
  // CRITICAL: do NOT touch updated.results — preserve logged data
  return { workout: updated, changed: true, reason };
}
