// Autoregulation / readiness engine.
//
// Computes a daily training-readiness score from:
//   1. Wearable signals (HRV, RHR, sleep duration) compared against
//      a 14-day rolling personal baseline
//   2. Subjective load (sRPE × duration) tracked as ACWR (acute:chronic
//      workload ratio, Foster 2001 / Gabbett 2016)
//   3. Self-report fallbacks (sleep slider, stress slider) when
//      wearable isn't connected
//
// Confidence-graded output so the caller knows whether to act on the
// recommendation or fall back to deterministic thresholds:
//
//   baseline_only  — < 7 days of data, return UNKNOWN, caller should
//                    use the existing recovery-readout hardcoded rules.
//   low            — 7-13 days, only soft DELOAD nudges (no STOP).
//   medium         — 14-27 days, full engine but flag uncertainty.
//   high           — 28+ days, trust the recommendation.
//
// Why cold-start instead of population priors: a 75ms HRV athlete
// seeded with "average" 55ms reads as elevated readiness on a normal
// day → engine pushes harder → real fatigue masked → injury risk.
// A 38ms HRV deconditioned operator seeded with 55ms reads as low
// readiness on a normal day → engine over-rests → no progressive
// overload. Both failure modes are worse than honest "we're learning".

import { prisma } from '@/lib/db';

export type ReadinessStatus = 'go_hard' | 'normal' | 'caution' | 'rest' | 'unknown';
export type ReadinessConfidence = 'baseline_only' | 'low' | 'medium' | 'high';
export type ReadinessSource = 'wearable_personal' | 'self_report' | 'fallback' | 'mixed';

export interface ReadinessFactor {
  key: string;
  label: string;
  value: string;          // human-readable (e.g. "62 ms (-12% vs baseline)")
  signal: 'good' | 'warn' | 'bad' | 'neutral';
  weight: number;         // 0-1, contribution to overall score
}

export interface ReadinessScore {
  status: ReadinessStatus;
  confidence: ReadinessConfidence;
  source: ReadinessSource;
  /** Numeric score 0-100 — not surfaced directly but used for sorting / debugging. */
  rawScore: number;
  factors: ReadinessFactor[];
  /** Days of data feeding the personal baseline. */
  baselineDays: number;
  /** ACWR — only present when ≥ 14 days of session-load history. */
  acwr?: number;
  /** Rationale string the UI can surface verbatim if it wants. */
  rationale: string;
  /** Recommendation gate — when true, caller should fall back to existing
   *  hardcoded thresholds (recovery-readout's behavior pre-engine). */
  fallbackToHardcoded: boolean;
}

const COLD_START_DAYS = 7;
const LOW_CONFIDENCE_DAYS = 14;
const HIGH_CONFIDENCE_DAYS = 28;

// ACWR sweet-spot per Gabbett 2016 — outside this band increases injury
// risk (above) or detrains (below).
const ACWR_SWEET_SPOT = { low: 0.8, high: 1.3 };
const ACWR_DANGER_HIGH = 1.5;  // above this → mandatory deload

interface OperatorReadinessInput {
  operatorId: string;
}

/**
 * Compute readiness for an operator. Reads from:
 *   - WearableConnection.syncData (latest active sync)
 *   - OperatorBaseline (rolling means/SDs computed by daily cron)
 *   - Operator.profile (self-report sleep/stress fallback)
 *
 * Returns a ReadinessScore with explicit confidence so callers can
 * decide whether to surface the recommendation or fall back.
 */
export async function readinessScore(input: OperatorReadinessInput): Promise<ReadinessScore> {
  const { operatorId } = input;

  // Pull the three data sources in parallel.
  const [op, baseline, conns] = await Promise.all([
    prisma.operator.findUnique({ where: { id: operatorId } }),
    prisma.operatorBaseline.findUnique({ where: { operatorId } }),
    prisma.wearableConnection.findMany({
      where: { operatorId, active: true },
      orderBy: { lastSyncAt: 'desc' },
      take: 1,
    }),
  ]);

  if (!op) {
    return cold('Operator not found.', 0);
  }

  const baselineDays = baseline?.baselineDays ?? 0;
  const wearable = conns[0];
  const syncData = (wearable?.syncData || {}) as Record<string, unknown>;
  const sleep = (syncData.sleep || {}) as Record<string, unknown>;
  const recovery = (syncData.recovery || {}) as Record<string, unknown>;

  const hrv = typeof recovery.hrv === 'number' ? Number(recovery.hrv) : null;
  const rhr = typeof recovery.restingHr === 'number' ? Number(recovery.restingHr) : null;
  const sleepHours = typeof sleep.duration === 'number' ? Number(sleep.duration) / 3600 : null;
  const recoveryScore = typeof recovery.score === 'number' ? Number(recovery.score) : null;

  // ── COLD START ──
  // Less than 7 days of baseline data — don't trust the engine,
  // tell caller to use the deterministic thresholds.
  if (baselineDays < COLD_START_DAYS) {
    return {
      status: 'unknown',
      confidence: 'baseline_only',
      source: 'fallback',
      rawScore: 50,
      factors: collectRawFactors(hrv, rhr, sleepHours, recoveryScore),
      baselineDays,
      rationale: baselineDays === 0
        ? 'Building your baseline. Readings sharpen after 7 days of data.'
        : `Day ${baselineDays} of 7 — engine activates after the first week of data.`,
      fallbackToHardcoded: true,
    };
  }

  const factors: ReadinessFactor[] = [];
  let score = 50;     // neutral midpoint
  let weightSum = 0;

  // ── HRV — z-score against personal baseline ──
  // Each standard deviation below the mean = ~10 score points off.
  // HRV trends up = good, down = bad.
  if (hrv != null && baseline?.hrvRollingMean != null && baseline.hrvRollingSD && baseline.hrvRollingSD > 0) {
    const z = (hrv - baseline.hrvRollingMean) / baseline.hrvRollingSD;
    const points = clamp(z * 10, -25, 25);
    score += points * 0.30;
    weightSum += 0.30;
    factors.push({
      key: 'hrv',
      label: 'HRV vs baseline',
      value: `${hrv.toFixed(0)}ms (${pct(hrv, baseline.hrvRollingMean)})`,
      signal: z >= 0.5 ? 'good' : z >= -0.5 ? 'neutral' : z >= -1.5 ? 'warn' : 'bad',
      weight: 0.30,
    });
  }

  // ── RHR — z-score, INVERTED (high RHR = low readiness) ──
  if (rhr != null && baseline?.rhrRollingMean != null) {
    const delta = rhr - baseline.rhrRollingMean;
    // Each +5 bpm = ~5 score points off (rough heuristic; refine with
    // user data once we have it).
    const points = clamp(-delta, -15, 15);
    score += points * 0.15;
    weightSum += 0.15;
    factors.push({
      key: 'rhr',
      label: 'Resting HR vs baseline',
      value: `${rhr.toFixed(0)}bpm (${pct(rhr, baseline.rhrRollingMean)})`,
      signal: delta <= -2 ? 'good' : delta <= 2 ? 'neutral' : delta <= 5 ? 'warn' : 'bad',
      weight: 0.15,
    });
  }

  // ── Sleep duration vs personal mean ──
  if (sleepHours != null && baseline?.sleepHoursMean != null) {
    const delta = sleepHours - baseline.sleepHoursMean;
    // Each hour off mean = ~10 score points.
    const points = clamp(delta * 10, -20, 20);
    score += points * 0.20;
    weightSum += 0.20;
    factors.push({
      key: 'sleep',
      label: 'Sleep vs baseline',
      value: `${sleepHours.toFixed(1)}h (${pct(sleepHours, baseline.sleepHoursMean)})`,
      signal: delta >= 0 ? 'good' : delta >= -0.5 ? 'neutral' : delta >= -1.5 ? 'warn' : 'bad',
      weight: 0.20,
    });
  }

  // ── ACWR — Foster's training load math ──
  //   acute = sum of last 7 days' (sRPE × duration_min)
  //   chronic = rolling 28d mean of daily loads
  //   acwr = acute / chronic
  // Sweet spot 0.8-1.3 (Gabbett). Above 1.5 = injury risk spike.
  if (baseline?.acwr != null) {
    const acwr = baseline.acwr;
    let acwrPoints = 0;
    let acwrSignal: ReadinessFactor['signal'] = 'neutral';
    if (acwr >= ACWR_SWEET_SPOT.low && acwr <= ACWR_SWEET_SPOT.high) {
      acwrPoints = 10;
      acwrSignal = 'good';
    } else if (acwr < ACWR_SWEET_SPOT.low) {
      // Detraining zone — recommend pushing harder
      acwrPoints = -5;
      acwrSignal = 'warn';
    } else if (acwr <= ACWR_DANGER_HIGH) {
      // Elevated load — caution
      acwrPoints = -15;
      acwrSignal = 'warn';
    } else {
      // Spike zone — mandatory deload
      acwrPoints = -30;
      acwrSignal = 'bad';
    }
    score += acwrPoints * 0.25;
    weightSum += 0.25;
    factors.push({
      key: 'acwr',
      label: 'Workload (ACWR)',
      value: acwr.toFixed(2),
      signal: acwrSignal,
      weight: 0.25,
    });
  }

  // ── Recovery score (provider-computed, e.g. WHOOP) ──
  // Treat as a tie-breaker when present; doesn't dominate.
  if (recoveryScore != null) {
    const points = clamp((recoveryScore - 50) * 0.5, -25, 25);
    score += points * 0.10;
    weightSum += 0.10;
    factors.push({
      key: 'recovery_score',
      label: 'Provider recovery score',
      value: `${recoveryScore}/100`,
      signal: recoveryScore >= 67 ? 'good' : recoveryScore >= 34 ? 'neutral' : 'bad',
      weight: 0.10,
    });
  }

  // If we got nothing usable from wearable + no baseline, fall back.
  if (weightSum === 0) {
    return cold('No usable signals — falling back to self-report.', baselineDays);
  }

  // Normalize: if some weights were missing (e.g. no RHR), the partial
  // sum is fine — score stays around its current value, just less
  // confident. We don't divide because each factor adjusts a baseline
  // of 50 and the missing factors stay at neutral.
  const finalScore = clamp(score, 0, 100);

  // ── Confidence based on baseline maturity ──
  let confidence: ReadinessConfidence;
  if (baselineDays < LOW_CONFIDENCE_DAYS) confidence = 'low';
  else if (baselineDays < HIGH_CONFIDENCE_DAYS) confidence = 'medium';
  else confidence = 'high';

  // ── Status from final score, with safety floor on low confidence ──
  let status: ReadinessStatus;
  if (finalScore >= 70) status = 'go_hard';
  else if (finalScore >= 50) status = 'normal';
  else if (finalScore >= 30) status = 'caution';
  else status = 'rest';

  // Safety: at low confidence, never call REST. The downside of an
  // unwarranted rest day on shaky data isn't symmetrical to the
  // downside of letting someone who's actually trashed train —
  // training trashed risks injury, resting unnecessarily costs ~1
  // session of progress. But also don't recommend GO_HARD at low
  // confidence; that asymmetry says push under-confident calls
  // toward NORMAL or CAUTION.
  if (confidence === 'low') {
    if (status === 'rest') status = 'caution';
    if (status === 'go_hard') status = 'normal';
  }

  // Determine source.
  let source: ReadinessSource;
  const wearableUsed = factors.some(f => ['hrv', 'rhr', 'recovery_score'].includes(f.key));
  const loadUsed = factors.some(f => f.key === 'acwr');
  if (wearableUsed && loadUsed) source = 'mixed';
  else if (wearableUsed) source = 'wearable_personal';
  else source = 'self_report';

  return {
    status,
    confidence,
    source,
    rawScore: Math.round(finalScore),
    factors,
    baselineDays,
    acwr: baseline.acwr ?? undefined,
    rationale: buildRationale(status, confidence, factors, baseline.acwr ?? null),
    fallbackToHardcoded: false,
  };
}

// ── Helpers ──

function cold(rationale: string, baselineDays: number): ReadinessScore {
  return {
    status: 'unknown',
    confidence: 'baseline_only',
    source: 'fallback',
    rawScore: 50,
    factors: [],
    baselineDays,
    rationale,
    fallbackToHardcoded: true,
  };
}

function collectRawFactors(
  hrv: number | null,
  rhr: number | null,
  sleepHours: number | null,
  recoveryScore: number | null,
): ReadinessFactor[] {
  const out: ReadinessFactor[] = [];
  if (hrv != null) {
    out.push({ key: 'hrv', label: 'HRV (raw)', value: `${hrv.toFixed(0)}ms`, signal: 'neutral', weight: 0 });
  }
  if (rhr != null) {
    out.push({ key: 'rhr', label: 'Resting HR (raw)', value: `${rhr.toFixed(0)}bpm`, signal: 'neutral', weight: 0 });
  }
  if (sleepHours != null) {
    out.push({ key: 'sleep', label: 'Sleep (raw)', value: `${sleepHours.toFixed(1)}h`, signal: 'neutral', weight: 0 });
  }
  if (recoveryScore != null) {
    out.push({ key: 'recovery_score', label: 'Recovery score (raw)', value: `${recoveryScore}/100`, signal: 'neutral', weight: 0 });
  }
  return out;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function pct(value: number, baseline: number): string {
  if (baseline === 0) return 'no baseline';
  const delta = ((value - baseline) / baseline) * 100;
  const sign = delta >= 0 ? '+' : '';
  return `${sign}${delta.toFixed(0)}% vs baseline`;
}

function buildRationale(
  status: ReadinessStatus,
  confidence: ReadinessConfidence,
  factors: ReadinessFactor[],
  acwr: number | null,
): string {
  const tags = factors
    .filter(f => f.signal === 'bad' || f.signal === 'warn')
    .map(f => f.label);

  const parts: string[] = [];
  if (status === 'go_hard') {
    parts.push('All systems green vs your baseline.');
  } else if (status === 'normal') {
    parts.push('Standard day — run as written.');
  } else if (status === 'caution') {
    parts.push('Mixed signals — back off intensity 10-20% today.');
  } else if (status === 'rest') {
    parts.push('Multiple stress markers off baseline — prioritize recovery.');
  } else {
    parts.push('Insufficient data — using deterministic fallback.');
  }
  if (tags.length > 0) {
    parts.push(`Watch: ${tags.join(', ')}.`);
  }
  if (acwr != null && acwr > ACWR_DANGER_HIGH) {
    parts.push(`ACWR ${acwr.toFixed(2)} is in the spike zone — mandatory deload before injury risk compounds.`);
  }
  if (confidence === 'low') {
    parts.push('(Low confidence — engine still learning your patterns.)');
  }
  return parts.join(' ');
}
