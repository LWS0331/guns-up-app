import { describe, it, expect } from 'vitest';
import { mergeDailyOps, readDailyOps, isEmptyDailyOps } from '../dailyOpsSop';

describe('isEmptyDailyOps', () => {
  it('treats the {} default and non-objects as empty', () => {
    expect(isEmptyDailyOps({})).toBe(true);
    expect(isEmptyDailyOps(null)).toBe(true);
    expect(isEmptyDailyOps(undefined)).toBe(true);
    expect(isEmptyDailyOps('nope')).toBe(true);
  });

  it('treats a versioned object as non-empty', () => {
    expect(isEmptyDailyOps({ version: 1, markdown: 'x' })).toBe(false);
  });
});

describe('readDailyOps', () => {
  it('returns null for the unset default', () => {
    expect(readDailyOps({})).toBeNull();
  });
  it('passes through an authored SOP', () => {
    const sop = { version: 2, updatedAt: 'now', authoredBy: 'gunny', markdown: '# Ops' };
    expect(readDailyOps(sop)).toEqual(sop);
  });
});

describe('mergeDailyOps', () => {
  it('sets version 1 and stamps updatedAt on first write', () => {
    const merged = mergeDailyOps({}, { markdown: '# Day One' }, {
      authoredBy: 'gunny',
      now: '2026-06-19T12:00:00.000Z',
    });
    expect(merged.version).toBe(1);
    expect(merged.updatedAt).toBe('2026-06-19T12:00:00.000Z');
    expect(merged.authoredBy).toBe('gunny');
    expect(merged.markdown).toBe('# Day One');
  });

  it('increments version on each subsequent write (AC #5)', () => {
    const v1 = mergeDailyOps({}, { markdown: 'a' }, { now: 't1' });
    const v2 = mergeDailyOps(v1, { markdown: 'b' }, { now: 't2' });
    const v3 = mergeDailyOps(v2, { sleepProtocol: ['lights out 22:00'] }, { now: 't3' });
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    expect(v3.version).toBe(3);
    expect(v3.updatedAt).toBe('t3');
  });

  it('preserves fields not present in the patch', () => {
    const v1 = mergeDailyOps(
      {},
      { markdown: '# SOP', sleepProtocol: ['8h'] },
      { authoredBy: 'gunny' },
    );
    const v2 = mergeDailyOps(v1, { markdown: '# SOP v2' }, { authoredBy: 'gunny' });
    expect(v2.markdown).toBe('# SOP v2');
    expect(v2.sleepProtocol).toEqual(['8h']); // untouched
  });

  it('deep-merges nested phase and trainingVariants one level', () => {
    const v1 = mergeDailyOps(
      {},
      { phase: { current: 2, label: 'Accumulation', items: ['volume'] } },
      {},
    );
    const v2 = mergeDailyOps(v1, { phase: { label: 'Intensification' } }, {});
    expect(v2.phase).toEqual({ current: 2, label: 'Intensification', items: ['volume'] });

    const t1 = mergeDailyOps({}, { trainingVariants: { am: ['squat'] } }, {});
    const t2 = mergeDailyOps(t1, { trainingVariants: { pm: ['bench'] } }, {});
    expect(t2.trainingVariants).toEqual({ am: ['squat'], pm: ['bench'] });
  });

  it('replaces array fields wholesale when supplied', () => {
    const v1 = mergeDailyOps(
      {},
      { anchors: [{ id: 'a', label: 'wake' }, { id: 'b', label: 'sun' }] },
      {},
    );
    const v2 = mergeDailyOps(v1, { anchors: [{ id: 'c', label: 'sleep' }] }, {});
    expect(v2.anchors).toEqual([{ id: 'c', label: 'sleep' }]);
  });

  it('never trusts caller-supplied version/updatedAt', () => {
    const merged = mergeDailyOps(
      { version: 5, updatedAt: 'old' },
      // @ts-expect-error — version is not part of the patch type, but a
      // malicious/legacy caller might send it anyway.
      { version: 999, updatedAt: 'forged', markdown: 'x' },
      { now: 'fresh' },
    );
    expect(merged.version).toBe(6);
    expect(merged.updatedAt).toBe('fresh');
  });

  it('defaults authoredBy to operator and guarantees markdown is a string', () => {
    const merged = mergeDailyOps({}, { sleepProtocol: ['8h'] }, {});
    expect(merged.authoredBy).toBe('operator');
    expect(merged.markdown).toBe('');
  });

  it('does not mutate the existing object', () => {
    const existing = { version: 1, updatedAt: 't', authoredBy: 'gunny', markdown: 'a' };
    const snapshot = JSON.stringify(existing);
    mergeDailyOps(existing, { markdown: 'b' }, { now: 't2' });
    expect(JSON.stringify(existing)).toBe(snapshot);
  });
});
