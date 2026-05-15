// First test file in the repo. Doubles as a runner sanity check —
// if vitest can resolve the `@/lib/...` alias, run TypeScript, and
// exercise pure logic, the scaffold is good. Once the scaffold is
// proven, more tests (per-route, per-component) layer on.
//
// Coverage target: src/lib/restTimer.ts (WS2 — auto-start rest after
// each completed set). The five-variant regex bank is the part with
// the highest defect density per LOC; tests pin every variant.

import { describe, it, expect } from 'vitest';
import {
  parseRestSeconds,
  resolveRestSeconds,
  APP_DEFAULT_REST_SEC,
} from '@/lib/restTimer';

describe('parseRestSeconds', () => {
  it('returns null for empty / missing prescription', () => {
    expect(parseRestSeconds(undefined)).toBeNull();
    expect(parseRestSeconds(null)).toBeNull();
    expect(parseRestSeconds('')).toBeNull();
    expect(parseRestSeconds('4x8 @ RPE 8')).toBeNull(); // no rest token
  });

  describe('Variant 1 — "rest MM:SS" explicit colon time', () => {
    it('parses "rest 2:00"', () => {
      const r = parseRestSeconds('4x5 rest 2:00');
      expect(r?.seconds).toBe(120);
    });
    it('parses "Rest: 1:30" with colon separator', () => {
      const r = parseRestSeconds('Rest: 1:30 between sets');
      expect(r?.seconds).toBe(90);
    });
    it('parses "rest period 3:00"', () => {
      const r = parseRestSeconds('5x3 rest period 3:00');
      expect(r?.seconds).toBe(180);
    });
  });

  describe('Variant 2 — keyword + value + unit', () => {
    it('parses "rest 90 sec"', () => {
      const r = parseRestSeconds('Rest 90 sec');
      expect(r?.seconds).toBe(90);
    });
    it('parses "rest 2 min"', () => {
      const r = parseRestSeconds('rest 2 min between sets');
      expect(r?.seconds).toBe(120);
    });
    it('parses long-form "rest 3 minutes"', () => {
      const r = parseRestSeconds('rest 3 minutes');
      expect(r?.seconds).toBe(180);
    });
  });

  describe('Variant 3 — reversed value-unit-keyword', () => {
    it('parses "90s rest" — was silently no-op before WS2', () => {
      const r = parseRestSeconds('5x3, 90s rest');
      expect(r?.seconds).toBe(90);
    });
    it('parses "2 min rest"', () => {
      const r = parseRestSeconds('4x6, 2 min rest');
      expect(r?.seconds).toBe(120);
    });
  });

  describe('Variant 4 — range, take the low end', () => {
    it('parses "rest 90-120s" → 90', () => {
      const r = parseRestSeconds('rest 90-120s');
      expect(r?.seconds).toBe(90);
    });
    it('parses "rest 2-3 min" → 120s (low end of range)', () => {
      const r = parseRestSeconds('rest 2-3 min');
      expect(r?.seconds).toBe(120);
    });
  });

  describe('Variant 5 — bare number after keyword', () => {
    it('"rest 2" infers MIN (becomes 120s) — 1-5 disambiguation', () => {
      const r = parseRestSeconds('rest 2');
      expect(r?.seconds).toBe(120);
    });
    it('"rest 90" infers SEC (stays 90s) — 6+ disambiguation', () => {
      const r = parseRestSeconds('rest 90');
      expect(r?.seconds).toBe(90);
    });
    it('"rest: 60" infers SEC', () => {
      const r = parseRestSeconds('rest: 60');
      expect(r?.seconds).toBe(60);
    });
  });

  describe('Safety caps', () => {
    it('rejects absurd "rest 9999 min" via MAX_REASONABLE_REST_SEC', () => {
      // 9999 min > 600s cap → falls through to next variant which
      // also fails the cap → returns null
      const r = parseRestSeconds('rest 9999 min');
      expect(r).toBeNull();
    });
  });
});

describe('resolveRestSeconds', () => {
  it('prescription wins when present', () => {
    expect(resolveRestSeconds('rest 90s', 60)).toMatchObject({
      seconds: 90,
      from: 'prescription',
    });
  });

  it('falls back to operator preference when prescription has no hint', () => {
    expect(resolveRestSeconds('4x8 @ RPE 8', 180)).toMatchObject({
      seconds: 180,
      from: 'preference_default',
    });
  });

  it('falls back to app default when both prescription and pref are absent', () => {
    expect(resolveRestSeconds('4x8 @ RPE 8', undefined)).toMatchObject({
      seconds: APP_DEFAULT_REST_SEC,
      from: 'app_default',
    });
  });

  it('opted_out when pref is explicitly 0', () => {
    expect(resolveRestSeconds('4x8 @ RPE 8', 0)).toMatchObject({
      seconds: 0,
      from: 'opted_out',
    });
  });

  it('prescription overrides opted_out (if Gunny writes "rest", honor it)', () => {
    // Operator opted out of auto-default, but the day's workout has
    // an explicit rest call — explicit beats opted-out.
    expect(resolveRestSeconds('rest 60s', 0)).toMatchObject({
      seconds: 60,
      from: 'prescription',
    });
  });
});
