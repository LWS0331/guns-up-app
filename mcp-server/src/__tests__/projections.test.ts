// @vitest-environment node

import { describe, it, expect } from 'vitest';
import {
  assertValidDateRange,
  projectNutritionInRange,
  projectProfileSummary,
  projectWorkoutsInRange,
} from '../projections.js';
import type { Operator } from '../api-client.js';

function makeOperator(overrides: Partial<Operator> = {}): Operator {
  return {
    id: 'op-1',
    callsign: 'RAMPAGE',
    ...overrides,
  };
}

describe('assertValidDateRange', () => {
  it('accepts equal endpoints', () => {
    expect(() =>
      assertValidDateRange({ from: '2026-05-19', to: '2026-05-19' })
    ).not.toThrow();
  });

  it('accepts ascending range', () => {
    expect(() =>
      assertValidDateRange({ from: '2026-05-01', to: '2026-05-19' })
    ).not.toThrow();
  });

  it('throws when from > to', () => {
    expect(() =>
      assertValidDateRange({ from: '2026-05-19', to: '2026-05-01' })
    ).toThrow(/Invalid range.*2026-05-19.*2026-05-01/);
  });
});

describe('projectNutritionInRange', () => {
  const op = makeOperator({
    nutrition: {
      targets: { calories: 3000, protein: 234, carbs: 329, fat: 83 },
      meals: {
        '2026-05-05': [
          { name: 'Oats', calories: 400, protein: 20, carbs: 60, fat: 8 },
          { name: 'Chicken bowl', calories: 700, protein: 60, carbs: 70, fat: 15 },
        ],
        '2026-05-10': [
          { name: 'Steak', calories: 800, protein: 70, carbs: 0, fat: 50 },
        ],
        '2026-05-19': [
          { name: 'Protein shake', calories: 250, protein: 40, carbs: 10, fat: 5 },
        ],
        // Outside the range we'll query
        '2026-04-30': [
          { name: 'Pizza', calories: 1200, protein: 40, carbs: 130, fat: 50 },
        ],
        '2026-05-25': [
          { name: 'Future meal', calories: 500, protein: 30, carbs: 50, fat: 15 },
        ],
      },
    },
  });

  it('returns empty days when no meals are logged', () => {
    const empty = makeOperator({ nutrition: { targets: undefined, meals: {} } });
    const result = projectNutritionInRange(empty, {
      from: '2026-05-01',
      to: '2026-05-19',
    });
    expect(result.days).toEqual([]);
    expect(result.from).toBe('2026-05-01');
    expect(result.to).toBe('2026-05-19');
  });

  it('filters meals to the inclusive range', () => {
    const result = projectNutritionInRange(op, {
      from: '2026-05-05',
      to: '2026-05-19',
    });
    const dates = result.days.map((d) => d.date);
    expect(dates).toEqual(['2026-05-05', '2026-05-10', '2026-05-19']);
  });

  it('includes both endpoints (boundary check)', () => {
    const result = projectNutritionInRange(op, {
      from: '2026-05-05',
      to: '2026-05-05',
    });
    expect(result.days.map((d) => d.date)).toEqual(['2026-05-05']);
  });

  it('sums macros per day', () => {
    const result = projectNutritionInRange(op, {
      from: '2026-05-05',
      to: '2026-05-05',
    });
    expect(result.days[0].totals).toEqual({
      calories: 1100,
      protein: 80,
      carbs: 130,
      fat: 23,
    });
  });

  it('sorts days ascending by date', () => {
    const result = projectNutritionInRange(op, {
      from: '2026-05-01',
      to: '2026-05-31',
    });
    const dates = result.days.map((d) => d.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('includes operator targets in output', () => {
    const result = projectNutritionInRange(op, {
      from: '2026-05-05',
      to: '2026-05-19',
    });
    expect(result.targets).toEqual({
      calories: 3000,
      protein: 234,
      carbs: 329,
      fat: 83,
    });
  });

  it('throws on inverted range', () => {
    expect(() =>
      projectNutritionInRange(op, { from: '2026-05-19', to: '2026-05-05' })
    ).toThrow(/Invalid range/);
  });

  it('handles operators with no nutrition block', () => {
    const bare = makeOperator();
    const result = projectNutritionInRange(bare, {
      from: '2026-05-01',
      to: '2026-05-19',
    });
    expect(result.days).toEqual([]);
    expect(result.targets).toBeUndefined();
  });

  it('treats missing macro fields as zero in totals', () => {
    const partial = makeOperator({
      nutrition: {
        meals: {
          '2026-05-05': [
            { name: 'Mystery snack', calories: 200 } as never,
          ],
        },
      },
    });
    const result = projectNutritionInRange(partial, {
      from: '2026-05-05',
      to: '2026-05-05',
    });
    expect(result.days[0].totals).toEqual({
      calories: 200,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });
});

describe('projectWorkoutsInRange', () => {
  const op = makeOperator({
    workouts: {
      '2026-05-05': { id: 'w1', date: '2026-05-05', title: 'Push', blocks: [] },
      '2026-05-10': { id: 'w2', date: '2026-05-10', title: 'Pull', blocks: [] },
      '2026-05-19': { id: 'w3', date: '2026-05-19', title: 'Legs', blocks: [] },
      '2026-04-30': { id: 'w0', date: '2026-04-30', title: 'Old', blocks: [] },
    },
  });

  it('filters workouts to the inclusive range', () => {
    const result = projectWorkoutsInRange(op, {
      from: '2026-05-05',
      to: '2026-05-19',
    });
    expect(Object.keys(result).sort()).toEqual([
      '2026-05-05',
      '2026-05-10',
      '2026-05-19',
    ]);
  });

  it('returns empty record when nothing matches', () => {
    const result = projectWorkoutsInRange(op, {
      from: '2026-06-01',
      to: '2026-06-30',
    });
    expect(result).toEqual({});
  });

  it('throws on inverted range', () => {
    expect(() =>
      projectWorkoutsInRange(op, { from: '2026-05-19', to: '2026-05-05' })
    ).toThrow(/Invalid range/);
  });

  it('handles operator with no workouts', () => {
    const bare = makeOperator();
    expect(
      projectWorkoutsInRange(bare, { from: '2026-05-01', to: '2026-05-31' })
    ).toEqual({});
  });
});

describe('projectProfileSummary', () => {
  it('returns the sorted workout + nutrition date keys', () => {
    const op = makeOperator({
      workouts: {
        '2026-05-10': { id: 'w1', date: '2026-05-10', title: 'B', blocks: [] },
        '2026-05-05': { id: 'w2', date: '2026-05-05', title: 'A', blocks: [] },
      },
      nutrition: {
        targets: { calories: 3000, protein: 234, carbs: 329, fat: 83 },
        meals: {
          '2026-05-19': [],
          '2026-05-01': [],
          '2026-05-10': [],
        },
      },
    });
    const summary = projectProfileSummary(op);
    expect(summary.workoutDates).toEqual(['2026-05-05', '2026-05-10']);
    expect(summary.nutritionDates).toEqual([
      '2026-05-01',
      '2026-05-10',
      '2026-05-19',
    ]);
    expect(summary.nutritionTargets).toEqual({
      calories: 3000,
      protein: 234,
      carbs: 329,
      fat: 83,
    });
  });

  it('handles operators with no nutrition or workouts', () => {
    const bare = makeOperator();
    const summary = projectProfileSummary(bare);
    expect(summary.workoutDates).toEqual([]);
    expect(summary.nutritionDates).toEqual([]);
    expect(summary.nutritionTargets).toBeUndefined();
    expect(summary.prCount).toBe(0);
    expect(summary.injuryCount).toBe(0);
  });

  it('counts prs and injuries', () => {
    const op = makeOperator({
      prs: [
        { exercise: 'Bench', weight: 225, date: '2026-05-01' },
        { exercise: 'Squat', weight: 315, date: '2026-05-02' },
      ],
      injuries: [{ name: 'L knee' }, { name: 'R shoulder' }, { name: 'low back' }],
    });
    const summary = projectProfileSummary(op);
    expect(summary.prCount).toBe(2);
    expect(summary.injuryCount).toBe(3);
  });
});
