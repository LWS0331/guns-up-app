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

  // --- scheduled rest days bridge the streak (cyan/amber/red dayTags) ---
  const T = (color: string) => ({ color, note: color });

  it('bridges a scheduled rest day without adding to the count', () => {
    // Mon✅, Tue✅, rest Wed, Thu✅ → 3 (Wed bridges, does not increment)
    const w = { '2026-06-18': C('2026-06-18'), '2026-06-17': C('2026-06-17'), '2026-06-15': C('2026-06-15') };
    const tags = { '2026-06-16': T('cyan') };
    expect(computeWorkoutStreak(w, '2026-06-18', tags)).toBe(3);
  });

  it('bridges on amber (deload) and red (injured) tags too', () => {
    const w = { '2026-06-19': C('2026-06-19'), '2026-06-16': C('2026-06-16') };
    const amber = { '2026-06-18': T('amber'), '2026-06-17': T('amber') };
    expect(computeWorkoutStreak(w, '2026-06-19', amber)).toBe(2);
    const red = { '2026-06-18': T('red'), '2026-06-17': T('red') };
    expect(computeWorkoutStreak(w, '2026-06-19', red)).toBe(2);
  });

  it('bridges a red-tagged day even when a workout was missed (injured/sick)', () => {
    const w = { '2026-06-19': C('2026-06-19'), '2026-06-18': P('2026-06-18'), '2026-06-17': C('2026-06-17') };
    const tags = { '2026-06-18': T('red') };
    expect(computeWorkoutStreak(w, '2026-06-19', tags)).toBe(2);
  });

  it('still breaks on an untracked empty day (no workout, no tag)', () => {
    const w = { '2026-06-19': C('2026-06-19'), '2026-06-17': C('2026-06-17') };
    expect(computeWorkoutStreak(w, '2026-06-19', {})).toBe(1);
  });

  it('still breaks on a past missed workout with no rest tag', () => {
    const w = { '2026-06-19': C('2026-06-19'), '2026-06-18': P('2026-06-18'), '2026-06-17': C('2026-06-17') };
    expect(computeWorkoutStreak(w, '2026-06-19', {})).toBe(1);
  });

  it('does not bridge on a green (great session) tag', () => {
    const w = { '2026-06-19': C('2026-06-19'), '2026-06-17': C('2026-06-17') };
    const tags = { '2026-06-18': T('green') };
    expect(computeWorkoutStreak(w, '2026-06-19', tags)).toBe(1);
  });

  it('a rest day today preserves but does not add to the streak', () => {
    const w = { '2026-06-18': C('2026-06-18'), '2026-06-17': C('2026-06-17') };
    const tags = { '2026-06-19': T('cyan') };
    expect(computeWorkoutStreak(w, '2026-06-19', tags)).toBe(2);
  });

  it('returns 0 for a run of only rest days (bridges never increment)', () => {
    const tags = { '2026-06-19': T('cyan'), '2026-06-18': T('cyan'), '2026-06-17': T('amber') };
    expect(computeWorkoutStreak({}, '2026-06-19', tags)).toBe(0);
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

  it('excludes the day exactly windowDays ago (true trailing 7 calendar days)', () => {
    const w = {
      '2026-06-19': C('2026-06-19'), // today — in
      '2026-06-13': P('2026-06-13'), // 6 days ago — in (not completed)
      '2026-06-12': C('2026-06-12'), // exactly 7 days ago — OUT
    };
    // In-window: 2 scheduled (today + 06-13), 1 completed → 50.
    // If 06-12 leaked in it would read 67 (3 scheduled, 2 completed).
    expect(computeCompliance(w, '2026-06-19')).toBe(50);
  });
});
