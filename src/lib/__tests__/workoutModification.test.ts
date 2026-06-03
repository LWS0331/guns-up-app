// @vitest-environment node
//
// Round-trip coverage for `set_fields` — the metadata-patch mod added
// 2026-06-02 to close the data-loss path where stamping notes onto a
// completed session via add_or_update_workout wiped workout.results.

import { describe, it, expect } from 'vitest';
import {
  applyWorkoutModification,
  type SetFieldsMod,
} from '../workoutModification';
import type { Workout, WorkoutResults } from '../types';

function makeWorkoutWithResults(): Workout {
  const results: WorkoutResults = {
    startTime: '2026-06-02T18:32:00-07:00',
    endTime: '2026-06-02T19:23:00-07:00',
    blocks: {
      'block-1': {
        sets: [
          { weight: 40, reps: 10, completed: true },
          { weight: 40, reps: 10, completed: true },
          { weight: 40, reps: 10, completed: true },
          { weight: 40, reps: 10, completed: true },
        ],
      },
      'block-2': {
        sets: [
          { weight: 55, reps: 10, completed: true },
          { weight: 55, reps: 12, completed: true },
          { weight: 55, reps: 10, completed: true },
        ],
      },
    },
  } as unknown as WorkoutResults;

  return {
    id: 'wk-2026-06-02',
    date: '2026-06-02',
    title: 'Shoulders + lateral volume',
    notes: '',
    warmup: 'band pull-aparts 2x15',
    cooldown: 'lat stretch 2x30s',
    completed: true,
    sessionRpe: 7,
    sessionDurationMin: 38,
    blocks: [
      {
        id: 'block-1',
        type: 'exercise',
        sortOrder: 0,
        exerciseName: 'Seated DB Shoulder Press',
        prescription: '4x10 @ 40',
        isLinkedToNext: false,
      },
      {
        id: 'block-2',
        type: 'exercise',
        sortOrder: 1,
        exerciseName: 'Landmine Press',
        prescription: '3x10 @ 55',
        isLinkedToNext: false,
      },
    ],
    results,
  };
}

describe('set_fields modification', () => {
  it('patches notes without touching results or block IDs', () => {
    const before = makeWorkoutWithResults();
    const result = applyWorkoutModification(before, {
      type: 'set_fields',
      fields: {
        notes:
          'Apple Watch: 51:15, 542 total cal / 447 active, 141 avg HR (peak 177), 6:32-7:23 PM Fresno.',
      },
    });

    expect(result.changed).toBe(true);
    expect(result.workout.notes).toContain('Apple Watch');
    // Results — byte-for-byte equality, no clone-then-mutate damage.
    expect(result.workout.results).toEqual(before.results);
    // Block IDs preserved (no regeneration).
    expect(result.workout.blocks.map((b) => b.id)).toEqual(
      before.blocks.map((b) => b.id),
    );
    // Existing block content untouched.
    expect(result.workout.blocks).toEqual(before.blocks);
  });

  it('patches multiple fields at once', () => {
    const before = makeWorkoutWithResults();
    const result = applyWorkoutModification(before, {
      type: 'set_fields',
      fields: {
        notes: 'session done',
        sessionRpe: 8,
        sessionDurationMin: 51,
        completed: true,
      },
    });

    expect(result.changed).toBe(true);
    expect(result.workout.notes).toBe('session done');
    expect(result.workout.sessionRpe).toBe(8);
    expect(result.workout.sessionDurationMin).toBe(51);
    expect(result.workout.completed).toBe(true);
    expect(result.workout.results).toEqual(before.results);
  });

  it('leaves unsupplied fields intact (no implicit clears)', () => {
    const before = makeWorkoutWithResults();
    const result = applyWorkoutModification(before, {
      type: 'set_fields',
      fields: { notes: 'just notes' },
    });

    expect(result.workout.title).toBe(before.title);
    expect(result.workout.warmup).toBe(before.warmup);
    expect(result.workout.cooldown).toBe(before.cooldown);
    expect(result.workout.sessionRpe).toBe(before.sessionRpe);
    expect(result.workout.sessionDurationMin).toBe(before.sessionDurationMin);
    expect(result.workout.completed).toBe(before.completed);
  });

  it('skips undefined values inside fields (zod .optional leaves them as undefined)', () => {
    const before = makeWorkoutWithResults();
    const result = applyWorkoutModification(before, {
      type: 'set_fields',
      fields: {
        notes: 'logged',
        title: undefined,
        sessionRpe: undefined,
      },
    });

    expect(result.changed).toBe(true);
    expect(result.workout.notes).toBe('logged');
    // Undefined entries were skipped, NOT written-as-undefined.
    expect(result.workout.title).toBe(before.title);
    expect(result.workout.sessionRpe).toBe(before.sessionRpe);
  });

  it('returns changed:false on empty payload', () => {
    const before = makeWorkoutWithResults();
    const result = applyWorkoutModification(before, {
      type: 'set_fields',
      fields: {},
    });

    expect(result.changed).toBe(false);
    expect(result.reason).toMatch(/empty payload/);
    // No-op: workout reference returned unchanged so React shallow-
    // compares can skip a re-render.
    expect(result.workout).toBe(before);
  });

  it('returns changed:false when all supplied fields are undefined', () => {
    const before = makeWorkoutWithResults();
    const result = applyWorkoutModification(before, {
      type: 'set_fields',
      fields: { notes: undefined, title: undefined },
    });

    expect(result.changed).toBe(false);
    expect(result.workout).toBe(before);
  });
});

describe('set_fields cannot reach blocks or results', () => {
  it('silently drops smuggled blocks / results / id / date keys', () => {
    const before = makeWorkoutWithResults();
    // Force a payload past the type system that tries to overwrite the
    // very fields set_fields is supposed to protect. The runtime
    // SET_FIELDS_ALLOWED gate must drop them.
    const sneaky = {
      type: 'set_fields' as const,
      fields: {
        notes: 'legit notes',
        blocks: [],
        results: null,
        id: 'spoofed',
        date: '1999-01-01',
      } as unknown as SetFieldsMod['fields'],
    };
    const result = applyWorkoutModification(before, sneaky);

    expect(result.workout.notes).toBe('legit notes');
    // Smuggled keys ignored — original blocks, results, id, and date
    // survive byte-for-byte.
    expect(result.workout.blocks).toEqual(before.blocks);
    expect(result.workout.results).toEqual(before.results);
    expect(result.workout.id).toBe(before.id);
    expect(result.workout.date).toBe(before.date);
  });
});
