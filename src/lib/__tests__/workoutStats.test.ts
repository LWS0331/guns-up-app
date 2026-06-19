import { describe, it, expect } from 'vitest';
import { computeWorkoutStreak, computeCompliance } from '../workoutStats';

const C = (date: string) => ({ id: date, date, title: 'x', blocks: [], completed: true });
const P = (date: string) => ({ id: date, date, title: 'x', blocks: [], completed: false });

describe('computeWorkoutStreak', () => {
  it('counts consecutive completed days ending today', () => {
    const w = { '2026-06-19': C('2026-06-19'), '2026-06-18': C('2026-06-18'), '2026-06-17': C('2026-06-17') };
    expect(computeWorkoutStreak(w, '2026-06-19')).toBe(3);
  });

  it('breaks on a gap before today', () => {
    const w = { '2026-06-19': C('2026-06-19'), '2026-06-18': C('2026-06-18'), '2026-06-16': C('2026-06-16') };
    expect(computeWorkoutStreak(w, '2026-06-19')).toBe(2);
  });

  it('still counts a streak built yesterday when today is pending', () => {
    const w = { '2026-06-18': C('2026-06-18'), '2026-06-17': C('2026-06-17') };
    expect(computeWorkoutStreak(w, '2026-06-19')).toBe(2);
  });

  it('returns 0 for no workouts / bad date', () => {
    expect(computeWorkoutStreak({}, '2026-06-19')).toBe(0);
    expect(computeWorkoutStreak(undefined, '2026-06-19')).toBe(0);
    expect(computeWorkoutStreak({ '2026-06-19': C('2026-06-19') }, 'nope')).toBe(0);
  });
});

describe('computeCompliance', () => {
  it('returns completed/scheduled percent over the window', () => {
    const w = {
      '2026-06-19': C('2026-06-19'),
      '2026-06-18': P('2026-06-18'),
      '2026-06-17': C('2026-06-17'),
      '2026-06-16': C('2026-06-16'),
    };
    // 3 completed of 4 scheduled in the last 7 days = 75
    expect(computeCompliance(w, '2026-06-19')).toBe(75);
  });

  it('ignores days outside the window', () => {
    const w = {
      '2026-06-19': C('2026-06-19'),
      '2026-06-01': P('2026-06-01'), // >7d ago — excluded
    };
    expect(computeCompliance(w, '2026-06-19')).toBe(100);
  });

  it('returns null when nothing scheduled in the window', () => {
    expect(computeCompliance({}, '2026-06-19')).toBeNull();
    expect(computeCompliance({ '2026-05-01': C('2026-05-01') }, '2026-06-19')).toBeNull();
  });
});
