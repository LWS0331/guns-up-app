import { describe, it, expect } from 'vitest';
import { detectSitrepDivergence } from '../sitrepFreshness';

// Minimal operator shapes — detectSitrepDivergence only reads
// preferences + sitrep.trainingPlan.
function op(prefs: Record<string, unknown> | null, plan: Record<string, unknown> | null) {
  return {
    preferences: prefs as never,
    sitrep: plan ? ({ trainingPlan: plan } as never) : undefined,
  };
}

describe('detectSitrepDivergence', () => {
  it('returns not-diverged when sitrep or preferences is missing', () => {
    expect(detectSitrepDivergence(null).diverged).toBe(false);
    expect(detectSitrepDivergence(op({ split: 'Bro Split', daysPerWeek: 5 }, null)).diverged).toBe(false);
    expect(detectSitrepDivergence(op(null, { split: 'Bro Split', daysPerWeek: 5 })).diverged).toBe(false);
  });

  it('flags a changed split (the op-ruben case)', () => {
    const r = detectSitrepDivergence(
      op(
        { split: 'BRO SPLIT (2 on / 1 off rotation)', daysPerWeek: 5 },
        { split: 'Upper / Lower 4-Day Split (Sciatic-Adapted)', daysPerWeek: 4 },
      ),
    );
    expect(r.diverged).toBe(true);
    expect(r.reason).toContain('BRO SPLIT');
    expect(r.reason).toContain('4'); // days/week mismatch also noted
  });

  it('flags a days/week change alone', () => {
    const r = detectSitrepDivergence(
      op({ split: 'Push Pull Legs', daysPerWeek: 6 }, { split: 'Push Pull Legs', daysPerWeek: 3 }),
    );
    expect(r.diverged).toBe(true);
    expect(r.reason).toContain('6 days/week');
  });

  it('treats cosmetically-different but equivalent splits as the same', () => {
    const r = detectSitrepDivergence(
      op(
        { split: 'Upper/Lower 4-Day Split', daysPerWeek: 4 },
        { split: 'upper / lower 4 day split (sciatic-adapted)', daysPerWeek: 4 },
      ),
    );
    expect(r.diverged).toBe(false);
  });

  it('does NOT flag a cosmetic LLM rephrase of the same split family (no nag loop)', () => {
    // trainingPlan.split is free-form LLM output; "5-Day Bro Split" must
    // not read as a change from the operator's "Bro Split" preference.
    const r = detectSitrepDivergence(
      op({ split: 'Bro Split', daysPerWeek: 5 }, { split: '5-Day Bro Split Routine', daysPerWeek: 5 }),
    );
    expect(r.diverged).toBe(false);
  });

  it('flags only a true split-family change (zero shared distinctive tokens)', () => {
    const r = detectSitrepDivergence(
      op({ split: 'Push Pull Legs', daysPerWeek: 6 }, { split: 'Arnold Split', daysPerWeek: 6 }),
    );
    expect(r.diverged).toBe(true);
  });

  it('does not flag when a field is missing on one side (no false positive)', () => {
    expect(detectSitrepDivergence(op({ daysPerWeek: 5 }, { split: 'Bro Split', daysPerWeek: 5 })).diverged).toBe(false);
    expect(detectSitrepDivergence(op({ split: 'Bro Split' }, { split: 'Bro Split' })).diverged).toBe(false);
  });
});
