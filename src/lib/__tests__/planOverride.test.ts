import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isPlanLocked, applyOverride, releaseOverride, readPlanOverride } from '../planOverride';

describe('readPlanOverride', () => {
  it('returns null for the unset default / non-objects', () => {
    expect(readPlanOverride({})).toBeNull();
    expect(readPlanOverride(null)).toBeNull();
    expect(readPlanOverride('nope')).toBeNull();
  });
  it('passes through a versioned override', () => {
    const ov = { active: true, lockedBy: 'op-ruben', lockedAt: 't', version: 1 };
    expect(readPlanOverride(ov)).toEqual(ov);
  });
});

describe('isPlanLocked', () => {
  it('is false when unset or inactive', () => {
    expect(isPlanLocked(null)).toBe(false);
    expect(isPlanLocked({ planOverride: {} })).toBe(false);
    expect(isPlanLocked({ planOverride: { active: false, version: 2 } })).toBe(false);
  });
  it('is true only when active', () => {
    expect(isPlanLocked({ planOverride: { active: true, lockedBy: 'x', lockedAt: 't', version: 1 } })).toBe(true);
  });
});

describe('applyOverride', () => {
  it('locks, stamps, and sets version 1 on first takeover', () => {
    const ov = applyOverride({}, { lockedBy: 'op-ruben', now: '2026-06-20T12:00:00Z' });
    expect(ov).toEqual({ active: true, lockedBy: 'op-ruben', lockedAt: '2026-06-20T12:00:00Z', version: 1 });
  });

  it('bumps version on each subsequent override', () => {
    const v1 = applyOverride({}, { lockedBy: 'op-ruben', now: 't1' });
    const v2 = applyOverride(v1, { lockedBy: 'op-ruben', now: 't2' });
    expect(v1.version).toBe(1);
    expect(v2.version).toBe(2);
    expect(v2.lockedAt).toBe('t2');
  });

  it('attaches a note and preserves it when not re-supplied', () => {
    const v1 = applyOverride({}, { lockedBy: 'op-ruben', note: 'deload week' });
    expect(v1.note).toBe('deload week');
    const v2 = applyOverride(v1, { lockedBy: 'op-ruben' });
    expect(v2.note).toBe('deload week'); // preserved
  });

  it('clears a note with an explicit empty string', () => {
    const v1 = applyOverride({}, { lockedBy: 'op-ruben', note: 'x' });
    const v2 = applyOverride(v1, { lockedBy: 'op-ruben', note: '' });
    expect(v2.note).toBeUndefined();
  });

  it('does not mutate the existing object', () => {
    const existing = { active: true, lockedBy: 'a', lockedAt: 't', version: 3 };
    const snap = JSON.stringify(existing);
    applyOverride(existing, { lockedBy: 'b', now: 't2' });
    expect(JSON.stringify(existing)).toBe(snap);
  });
});

describe('releaseOverride', () => {
  it('deactivates, bumps version, keeps audit trail', () => {
    const locked = applyOverride({}, { lockedBy: 'op-ruben', now: 't1' });
    const released = releaseOverride(locked, { lockedBy: 'op-ruben', now: 't2' });
    expect(released.active).toBe(false);
    expect(released.version).toBe(2);
    expect(released.lockedAt).toBe('t2');
    expect(isPlanLocked({ planOverride: released })).toBe(false);
  });
});

// The lock flag must ONLY be settable via the dedicated /daily-plan route.
// If a future contributor adds 'planOverride' to a general operator-PATCH
// allowlist, an operator could unlock their own head-trainer-managed plan.
// Lock the invariant the same way dailyOps does.
describe('planOverride clobber-safety', () => {
  it('planOverride is absent from every operator-PATCH field allowlist', () => {
    const src = readFileSync(
      join(process.cwd(), 'src/app/api/operators/[id]/route.ts'),
      'utf8',
    );
    const setBlocks = src.match(/new Set\(\[[\s\S]*?\]\)/g) || [];
    expect(setBlocks.length).toBeGreaterThanOrEqual(3); // ADMIN / SELF / TRAINER
    for (const block of setBlocks) {
      expect(block).not.toMatch(/['"]planOverride['"]/);
    }
  });
});
