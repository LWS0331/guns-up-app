import { describe, it, expect } from 'vitest';
import {
  APP_TIMEZONE,
  getAppTodayStr,
  getDateStrInTimezone,
  toLocalDateStr,
} from '../dateUtils';

describe('APP_TIMEZONE', () => {
  it('is Pacific Time', () => {
    expect(APP_TIMEZONE).toBe('America/Los_Angeles');
  });
});

describe('getDateStrInTimezone', () => {
  it('returns YYYY-MM-DD format', () => {
    const result = getDateStrInTimezone(new Date('2026-05-29T12:00:00Z'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('resolves Pacific Time across the UTC midnight boundary', () => {
    // 7am UTC on May 30 is midnight PDT (UTC-7) on May 29 — APP_TIMEZONE
    // should report the local date as 2026-05-29, NOT 2026-05-30.
    const utcMidMorning = new Date('2026-05-30T06:59:00Z');
    expect(getDateStrInTimezone(utcMidMorning)).toBe('2026-05-29');
  });

  it('honors an explicit timezone arg over the app default', () => {
    // 1am UTC on April 14 is 9pm EST (UTC-5) on April 13.
    const utcAfterMidnight = new Date('2026-04-14T01:00:00Z');
    expect(getDateStrInTimezone(utcAfterMidnight, 'America/New_York')).toBe(
      '2026-04-13'
    );
    // Same instant in UTC is April 14.
    expect(getDateStrInTimezone(utcAfterMidnight, 'UTC')).toBe('2026-04-14');
  });

  it('accepts a millisecond timestamp', () => {
    const ms = new Date('2026-05-29T12:00:00Z').getTime();
    expect(getDateStrInTimezone(ms)).toBe('2026-05-29');
  });

  it('accepts an ISO string', () => {
    expect(getDateStrInTimezone('2026-05-29T12:00:00Z')).toBe('2026-05-29');
  });

  it('defaults to the current instant when no date is passed', () => {
    const result = getDateStrInTimezone();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('handles DST transitions correctly (March spring-forward)', () => {
    // 2026-03-08 02:00 PST → 03:00 PDT. Verify the date roll happens
    // at the right local instant regardless of which side of the
    // transition we're on.
    const beforeSpring = new Date('2026-03-08T09:30:00Z'); // 01:30 PST
    const afterSpring = new Date('2026-03-08T11:30:00Z'); // 04:30 PDT
    expect(getDateStrInTimezone(beforeSpring)).toBe('2026-03-08');
    expect(getDateStrInTimezone(afterSpring)).toBe('2026-03-08');
  });
});

describe('getAppTodayStr', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(getAppTodayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('matches getDateStrInTimezone(now) with no args', () => {
    // Both reference "now" — should be on the same minute, almost always
    // the same date. Allowed to differ by 1 day only if we're racing
    // across the PT midnight tick (vanishingly unlikely; if this flakes,
    // the boundary case is itself proving the helpers agree).
    const a = getAppTodayStr();
    const b = getDateStrInTimezone(new Date(), APP_TIMEZONE);
    expect(a).toBe(b);
  });
});

describe('toLocalDateStr backward compatibility', () => {
  it('still returns the viewer-local date', () => {
    const result = toLocalDateStr(new Date());
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
