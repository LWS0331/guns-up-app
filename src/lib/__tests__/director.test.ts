import { describe, it, expect } from 'vitest';
import { isDirector, getDirectorTitle, isHeadTrainer, OPS_CENTER_ACCESS, HEAD_TRAINER_ACCESS } from '../types';

// In the test env neither NEXT_PUBLIC_OPS_CENTER_ACCESS nor
// NEXT_PUBLIC_HEAD_TRAINER_ACCESS is set, so both default to
// ['op-ruben','op-britney'] — the same as prod today.
describe('isDirector', () => {
  it('is true for the two co-directors (head trainer OR ops/admin)', () => {
    expect(isDirector('op-ruben')).toBe(true);
    expect(isDirector('op-britney')).toBe(true);
  });

  it('is false for a regular operator and for null/undefined', () => {
    expect(isDirector('op-wardog')).toBe(false);
    expect(isDirector(null)).toBe(false);
    expect(isDirector(undefined)).toBe(false);
  });

  it('is the union of head-trainer and ops/admin access', () => {
    for (const id of new Set([...OPS_CENTER_ACCESS, ...HEAD_TRAINER_ACCESS])) {
      expect(isDirector(id)).toBe(true);
    }
    // Anyone who is a director is at least one of the two authorities.
    expect(isDirector('op-ruben')).toBe(
      isHeadTrainer('op-ruben') || OPS_CENTER_ACCESS.includes('op-ruben'),
    );
  });
});

describe('getDirectorTitle', () => {
  it('returns the director title for each co-director', () => {
    expect(getDirectorTitle('op-ruben')).toMatch(/Strength & Conditioning/);
    expect(getDirectorTitle('op-britney')).toMatch(/Sport Performance \+ Junior Operators/);
  });

  it('returns null for non-directors and nullish ids', () => {
    expect(getDirectorTitle('op-wardog')).toBeNull();
    expect(getDirectorTitle(null)).toBeNull();
    expect(getDirectorTitle(undefined)).toBeNull();
  });
});
