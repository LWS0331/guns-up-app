import { describe, it, expect } from 'vitest';
import { buildSelfReportScore } from '../readiness';

// N3 keystone (PR #200): when there is NO objective wearable signal,
// readinessScore() degrades to self-report instead of returning UNKNOWN.
// buildSelfReportScore is the load-bearing helper that path routes through.
// selfReport.test.ts covers the pure scorer; these lock the readiness-engine
// contract callers depend on: an actionable status (not UNKNOWN), the
// self_report source, and the no-go_hard-on-sliders cap.
describe('buildSelfReportScore (self-report fallback, N3)', () => {
  it('fires REST on a trashed self-reported day (profile sliders)', () => {
    const sr = buildSelfReportScore({ profile: { readiness: 2, sleep: 4, stress: 9 } }, 0);
    expect(sr).not.toBeNull();
    expect(sr!.status).toBe('rest');
    expect(sr!.source).toBe('self_report');
    expect(sr!.fallbackToHardcoded).toBe(false); // actionable, not the old UNKNOWN
    expect(sr!.confidence).toBe('low');
  });

  it('caps a strong self-reported day at normal (never go_hard on sliders alone)', () => {
    const sr = buildSelfReportScore({ profile: { readiness: 9, sleep: 8, stress: 2 } }, 0);
    expect(sr).not.toBeNull();
    expect(sr!.status).toBe('normal');
    expect(sr!.source).toBe('self_report');
    expect(sr!.fallbackToHardcoded).toBe(false);
  });

  it('returns null when nothing is on file (caller falls through to cold-start)', () => {
    expect(buildSelfReportScore({ profile: {} }, 0)).toBeNull();
  });
});
