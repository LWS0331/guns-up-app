import { describe, it, expect } from 'vitest';
import {
  buildGroupSessionTemplate,
  coerceGroupWorkout,
  buildKidWorkoutRecord,
  representativeSportProfile,
  representativeAge,
  stripIntensityLanguage,
  EFFORT_TO_SRPE,
} from '../coachGroupSession';
import { applyJuniorGuardrailsToWorkout } from '../juniorGuardrails';
import type { Workout } from '../types';

const NOW = '2026-06-24T17:00:00.000Z';

describe('buildGroupSessionTemplate', () => {
  it('returns a runnable, uncompleted soccer session with blocks + a game', () => {
    const w = buildGroupSessionTemplate({ sport: 'soccer', ageBand: '4-7', memberCount: 5, dateISO: '2026-06-24' });
    expect(w.completed).toBe(false);
    expect(w.date).toBe('2026-06-24');
    expect(w.warmup).toBeTruthy();
    expect(w.cooldown).toBeTruthy();
    expect(w.blocks.length).toBeGreaterThanOrEqual(3);
    // ends on a small-sided game (a conditioning block)
    expect(w.blocks.some((b) => b.type === 'conditioning')).toBe(true);
    // every block has a unique id (fan-out keys blockResults by id)
    const ids = new Set(w.blocks.map((b) => b.id));
    expect(ids.size).toBe(w.blocks.length);
  });

  it('is guardrail-safe by construction (no caps tripped for a pre-PHV kid)', () => {
    const w = buildGroupSessionTemplate({ sport: 'soccer', ageBand: '4-7', memberCount: 4, dateISO: '2026-06-24' });
    const res = applyJuniorGuardrailsToWorkout(w, {
      isJunior: true,
      sportProfile: representativeSportProfile('soccer'),
      juniorAge: representativeAge('4-7'),
    });
    expect(res.ok).toBe(true);
    expect(res.modified).toBe(false);
  });
});

describe('coerceGroupWorkout', () => {
  const input = { sport: 'soccer' as const, ageBand: '4-7' as const, memberCount: 4, dateISO: '2026-06-24' };

  it('coerces a well-formed payload, marking game blocks as conditioning', () => {
    const w = coerceGroupWorkout(
      {
        title: 'Saturday Littles',
        warmup: 'animal moves',
        cooldown: 'cheer',
        blocks: [
          { name: 'Dribble tag', cue: '5 min little touches', kind: 'drill' },
          { name: 'Mini match', cue: '8 min small goals', kind: 'game' },
        ],
      },
      input,
    );
    expect(w).not.toBeNull();
    expect(w!.title).toBe('Saturday Littles');
    expect(w!.blocks).toHaveLength(2);
    expect(w!.blocks[0].type).toBe('exercise');
    expect(w!.blocks[1].type).toBe('conditioning');
  });

  it('infers a game block from the name even without kind', () => {
    const w = coerceGroupWorkout({ blocks: [{ name: '3v3 Scrimmage', cue: 'play' }] }, input);
    expect(w!.blocks[0].type).toBe('conditioning');
  });

  it('strips intensity/load tokens from model-authored cues (youth safety)', () => {
    const w = coerceGroupWorkout(
      { blocks: [{ name: 'Sprint game', cue: 'push hard to RPE 8 for 5 min', kind: 'game' }] },
      input,
    );
    const blk = w!.blocks[0];
    const text = blk.type === 'conditioning' ? blk.description : blk.prescription;
    expect(text).not.toMatch(/RPE/i);
  });

  it('falls back to defaults for missing fields', () => {
    const w = coerceGroupWorkout({ blocks: [{ name: 'Passing' }] }, input);
    expect(w!.warmup).toBeTruthy();
    expect(w!.cooldown).toBeTruthy();
    expect(w!.title).toBeTruthy();
  });

  it('returns null when there are no usable blocks (caller uses the template)', () => {
    expect(coerceGroupWorkout({ blocks: [] }, input)).toBeNull();
    expect(coerceGroupWorkout({ blocks: [{}] }, input)).toBeNull();
    expect(coerceGroupWorkout(null, input)).toBeNull();
  });
});

describe('stripIntensityLanguage', () => {
  it('removes RPE / %1RM / load tokens, keeps the rest', () => {
    expect(stripIntensityLanguage('dribble for 5 min RPE 8')).toBe('dribble for 5 min');
    expect(stripIntensityLanguage('squat @ 80% something')).toBe('squat something');
    expect(stripIntensityLanguage('test 5RM effort')).toBe('test effort');
    expect(stripIntensityLanguage('little touches, head up')).toBe('little touches, head up');
  });
});

describe('buildKidWorkoutRecord', () => {
  const shared: Workout = {
    id: 'grp-session-2026-06-24',
    date: '2026-06-24',
    title: 'Group Soccer',
    notes: 'coach-led',
    warmup: 'animal moves',
    blocks: [
      { type: 'exercise', id: 'b1', sortOrder: 1, exerciseName: 'Dribble', prescription: '5 min', isLinkedToNext: false },
      { type: 'conditioning', id: 'b2', sortOrder: 2, format: 'Mini game', description: '8 min', isLinkedToNext: false },
    ],
    cooldown: 'cheer',
    completed: false,
  };

  it('marks a present + completed kid done, with effort→sRPE and all blocks complete', () => {
    const rec = buildKidWorkoutRecord(shared, { attended: true, completed: true, effort: 'effortful', nowIso: NOW });
    expect(rec.completed).toBe(true);
    expect(rec.sessionRpe).toBe(EFFORT_TO_SRPE.effortful);
    expect(rec.results?.blockResults['b1'].sets[0].completed).toBe(true);
    expect(rec.results?.blockResults['b2'].sets[0].completed).toBe(true);
  });

  it('defaults effort to engaged when omitted', () => {
    const rec = buildKidWorkoutRecord(shared, { attended: true, completed: true, nowIso: NOW });
    expect(rec.sessionRpe).toBe(EFFORT_TO_SRPE.engaged);
  });

  it('logs an absent kid as not completed, no sRPE, with [COACH] Absent', () => {
    const rec = buildKidWorkoutRecord(shared, { attended: false, completed: false, nowIso: NOW });
    expect(rec.completed).toBe(false);
    expect(rec.sessionRpe).toBeUndefined();
    expect(rec.notes).toContain('[COACH] Absent');
    expect(rec.results?.blockResults['b1'].sets[0].completed).toBe(false);
  });

  it('appends a coach note under the [COACH] tag', () => {
    const rec = buildKidWorkoutRecord(shared, { attended: true, completed: true, note: 'great first touch', nowIso: NOW });
    expect(rec.notes).toContain('[COACH] great first touch');
    expect(rec.notes).toContain('coach-led'); // original note preserved
  });

  it('present-but-incomplete is not marked done', () => {
    const rec = buildKidWorkoutRecord(shared, { attended: true, completed: false, nowIso: NOW });
    expect(rec.completed).toBe(false);
  });
});
