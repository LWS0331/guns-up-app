import { describe, it, expect } from 'vitest';
import { buildRosterDigestEntry, buildRosterDigest } from '../rosterDigest';
import type { Operator } from '../types';

const C = (date: string) => ({ id: date, date, title: 'x', blocks: [], completed: true });
const P = (date: string) => ({ id: date, date, title: 'x', blocks: [], completed: false });

function op(over: Partial<Operator>): Operator {
  return { id: 'op-x', callsign: 'X', name: 'X', ...(over as object) } as Operator;
}

describe('buildRosterDigestEntry', () => {
  it('rolls up streak, compliance, last workout, and readiness', () => {
    const e = buildRosterDigestEntry(
      op({
        workouts: {
          '2026-06-20': C('2026-06-20'),
          '2026-06-19': C('2026-06-19'),
          '2026-06-18': P('2026-06-18'),
        } as never,
        dailyReadiness: {
          '2026-06-18': { readiness: 6 },
          '2026-06-20': { readiness: 8, sleep: 7, stress: 3 },
        } as never,
      }),
      '2026-06-20',
    );
    expect(e.streakDays).toBe(2); // 20 + 19 completed, 18 not
    expect(e.compliance7d).toBe(67); // 2 of 3 completed
    expect(e.lastWorkoutDate).toBe('2026-06-20');
    expect(e.latestReadiness).toEqual({ date: '2026-06-20', readiness: 8, sleep: 7, stress: 3 });
  });

  it('reports a managed plan and suppresses stale/diverged for it', () => {
    const e = buildRosterDigestEntry(
      op({
        sitrep: { generatedDate: '2026-05-05T20:00:00Z', trainingPlan: { split: 'Upper/Lower', daysPerWeek: 4 } } as never,
        preferences: { split: 'Bro Split', daysPerWeek: 5 } as never,
        planOverride: { active: true, lockedBy: 'op-ruben', lockedAt: 't', version: 1 } as never,
      }),
      '2026-06-20',
    );
    expect(e.planManaged).toBe(true);
    expect(e.sitrepStale).toBe(false); // managed → not reported stale
    expect(e.diverged).toBe(false);
  });

  it('flags stale + diverged when NOT managed', () => {
    const e = buildRosterDigestEntry(
      op({
        sitrep: { generatedDate: '2026-05-05T20:00:00Z', trainingPlan: { split: 'Upper/Lower', daysPerWeek: 4 } } as never,
        preferences: { split: 'Bro Split', daysPerWeek: 5 } as never,
      }),
      '2026-06-20',
    );
    expect(e.planManaged).toBe(false);
    expect(e.sitrepStale).toBe(true);
    expect(e.diverged).toBe(true);
  });

  it('handles an empty operator', () => {
    const e = buildRosterDigestEntry(op({}), '2026-06-20');
    expect(e.streakDays).toBe(0);
    expect(e.compliance7d).toBeNull();
    expect(e.lastWorkoutDate).toBeNull();
    expect(e.latestReadiness).toBeNull();
    expect(e.planManaged).toBe(false);
  });
});

describe('buildRosterDigest', () => {
  it('sorts most-recently-active first', () => {
    const a = op({ id: 'op-a', workouts: { '2026-06-10': C('2026-06-10') } as never });
    const b = op({ id: 'op-b', workouts: { '2026-06-20': C('2026-06-20') } as never });
    const digest = buildRosterDigest([a, b], '2026-06-20');
    expect(digest.map((d) => d.id)).toEqual(['op-b', 'op-a']);
  });
});
