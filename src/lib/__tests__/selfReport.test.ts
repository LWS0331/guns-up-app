import { describe, it, expect } from 'vitest';
import { computeSelfReportScore, readSelfReportInputs } from '../selfReport';

describe('computeSelfReportScore', () => {
  it('returns usable:false when nothing scorable is supplied', () => {
    expect(computeSelfReportScore({})).toEqual({ usable: false, score: 0, signals: [] });
    expect(computeSelfReportScore({ readiness: 0, stress: null }).usable).toBe(false);
  });

  it('scores a strong day high', () => {
    const r = computeSelfReportScore({ readiness: 9, sleep: 8, stress: 2, energy: 9 });
    expect(r.usable).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(80);
  });

  it('scores a trashed day low (fires DELOAD/REST downstream)', () => {
    const r = computeSelfReportScore({ readiness: 2, sleep: 4, stress: 9, energy: 2 });
    expect(r.usable).toBe(true);
    expect(r.score).toBeLessThan(30);
  });

  it('inverts stress — high stress lowers the score', () => {
    const calm = computeSelfReportScore({ stress: 1 }).score;
    const fried = computeSelfReportScore({ stress: 10 }).score;
    expect(calm).toBeGreaterThan(fried);
    expect(fried).toBe(0);
  });

  it('works from a single field', () => {
    const r = computeSelfReportScore({ readiness: 5 });
    expect(r.usable).toBe(true);
    expect(r.signals).toHaveLength(1);
    expect(r.score).toBe(50);
  });
});

describe('readSelfReportInputs', () => {
  const today = '2026-06-19';

  it('prefers today\'s check-in over profile', () => {
    const op = {
      dailyReadiness: { [today]: { readiness: 8, sleep: 7, stress: 3 } },
      profile: { readiness: 2, sleep: 4, stress: 9 },
    };
    const { inputs, source } = readSelfReportInputs(op, today);
    expect(source).toBe('check_in');
    expect(inputs.readiness).toBe(8);
  });

  it('falls back to profile when no check-in for today', () => {
    const op = {
      dailyReadiness: { '2026-06-01': { readiness: 8 } },
      profile: { readiness: 6, sleep: 7, stress: 4 },
    };
    const { inputs, source } = readSelfReportInputs(op, today);
    expect(source).toBe('profile');
    expect(inputs.readiness).toBe(6);
  });

  it('falls back to intake sleepQuality / stressLevel when profile lacks them', () => {
    const op = {
      profile: {},
      intake: { sleepQuality: 6, stressLevel: 5 },
    };
    const { inputs, source } = readSelfReportInputs(op, today);
    expect(source).toBe('profile');
    expect(inputs.sleep).toBe(6);
    expect(inputs.stress).toBe(5);
  });

  it('returns source none when nothing is on file', () => {
    expect(readSelfReportInputs({ profile: {}, dailyReadiness: {} }, today).source).toBe('none');
    expect(readSelfReportInputs(null, today).source).toBe('none');
  });
});
