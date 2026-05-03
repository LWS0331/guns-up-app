// Wearable signals — same-day readiness + sleep-debt computation
// for Daily Ops generation. Phase 2A.
//
// Distinct from personalRhythm.ts (which is a 14-day rolling
// behavioral aggregate). This module's job is "what does last
// night's sleep + this morning's HRV say about today's basis fields?"
// so Gunny can inject `sleepDebtHrs` and `readinessScore` into
// `DailyOpsBasis` automatically rather than guessing.

import { prisma } from '@/lib/db';

const ROLLING_BASELINE_DAYS = 7;

export interface WearableSignalSnapshot {
  /** Today's date (operator-local) — what the plan covers. */
  date: string;
  /** Hours slept last night, if reported. */
  lastNightSleepHrs: number | null;
  /** Mean of the last 7 days' sleep, excluding last night. */
  sleepBaseline7dHrs: number | null;
  /** lastNight - baseline7d. Negative = under-slept vs personal mean. */
  sleepDebtHrs: number | null;
  /** Last reported HRV (ms), if any. */
  hrv: number | null;
  /** 7-day rolling mean HRV, excluding today. */
  hrvBaseline7d: number | null;
  /** 0..100 — provider's recovery if present, otherwise derived heuristic. */
  readinessScore: number | null;
  /** Provider-reported recovery (0..100), if available. Higher fidelity than derived score. */
  recoveryScoreProvider: number | null;
  /** Source label for diagnostics — 'provider' / 'derived' / 'none'. */
  readinessSource: 'provider' | 'derived' | 'none';
}

interface SnapRow {
  syncDate: string;
  hrv: number | null;
  sleepHours: number | null;
  recoveryScore: number | null;
  sleepEfficiency: number | null;
}

function mean(xs: number[]): number | null {
  if (xs.length === 0) return null;
  return xs.reduce((s, v) => s + v, 0) / xs.length;
}

/**
 * Read the operator's last `ROLLING_BASELINE_DAYS+1` wearable
 * snapshots and produce the readiness/debt summary for `today`.
 *
 * If the operator has no wearable data at all (no Junction/Vital
 * device linked) we return a snapshot with all-nulls + readinessSource='none'
 * so the caller can omit the WEARABLE block from the prompt
 * gracefully.
 */
export async function getWearableSignals(
  operatorId: string,
  today: string,
): Promise<WearableSignalSnapshot> {
  const since = new Date(today);
  since.setDate(since.getDate() - (ROLLING_BASELINE_DAYS + 1));
  const sinceISO = since.toISOString().slice(0, 10);

  const rows: SnapRow[] = await prisma.wearableSnapshot.findMany({
    where: {
      operatorId,
      syncDate: { gte: sinceISO, lte: today },
    },
    select: {
      syncDate: true,
      hrv: true,
      sleepHours: true,
      recoveryScore: true,
      sleepEfficiency: true,
    },
    orderBy: { syncDate: 'desc' },
    take: ROLLING_BASELINE_DAYS + 1,
  });

  if (rows.length === 0) {
    return {
      date: today,
      lastNightSleepHrs: null,
      sleepBaseline7dHrs: null,
      sleepDebtHrs: null,
      hrv: null,
      hrvBaseline7d: null,
      readinessScore: null,
      recoveryScoreProvider: null,
      readinessSource: 'none',
    };
  }

  const todayRow = rows.find((r) => r.syncDate === today) ?? rows[0]; // fallback to most recent
  const baselineRows = rows.filter((r) => r.syncDate !== todayRow.syncDate);

  const lastNightSleepHrs = todayRow.sleepHours;
  const sleepBaseline = mean(
    baselineRows.map((r) => r.sleepHours).filter((v): v is number => v != null),
  );
  const sleepDebtHrs =
    lastNightSleepHrs != null && sleepBaseline != null
      ? Number((lastNightSleepHrs - sleepBaseline).toFixed(2))
      : null;

  const hrv = todayRow.hrv;
  const hrvBaseline = mean(
    baselineRows.map((r) => r.hrv).filter((v): v is number => v != null),
  );

  // Readiness — provider's recoveryScore if present, otherwise derive
  // a coarse 0..100 from the inputs we have. The derivation is
  // intentionally conservative; we'd rather under-claim certainty
  // than push Gunny toward an aggressive plan based on a fuzzy signal.
  let readinessScore: number | null = null;
  let readinessSource: 'provider' | 'derived' | 'none' = 'none';
  if (todayRow.recoveryScore != null) {
    readinessScore = Math.round(todayRow.recoveryScore);
    readinessSource = 'provider';
  } else if (lastNightSleepHrs != null && sleepBaseline != null) {
    // Derived: start from 70 baseline, adjust ±15 by sleep delta vs
    // baseline (clamped), ±10 by HRV delta vs baseline (when both
    // present). 70 is intentional — "above average operator on a
    // fine day" — so a missing-HRV but adequate-sleep day still
    // reads as moderate.
    let score = 70;
    const sleepDelta = lastNightSleepHrs - sleepBaseline;
    score += Math.max(-15, Math.min(15, Math.round(sleepDelta * 8)));
    if (hrv != null && hrvBaseline != null && hrvBaseline > 0) {
      const hrvDelta = (hrv - hrvBaseline) / hrvBaseline;
      score += Math.max(-10, Math.min(10, Math.round(hrvDelta * 30)));
    }
    if (todayRow.sleepEfficiency != null && todayRow.sleepEfficiency < 80) {
      score -= 5;
    }
    readinessScore = Math.max(0, Math.min(100, score));
    readinessSource = 'derived';
  }

  return {
    date: today,
    lastNightSleepHrs: lastNightSleepHrs ?? null,
    sleepBaseline7dHrs:
      sleepBaseline != null ? Number(sleepBaseline.toFixed(2)) : null,
    sleepDebtHrs,
    hrv: hrv ?? null,
    hrvBaseline7d: hrvBaseline != null ? Number(hrvBaseline.toFixed(1)) : null,
    readinessScore,
    recoveryScoreProvider: todayRow.recoveryScore ?? null,
    readinessSource,
  };
}

// ---------------------------------------------------------------------------
// Prompt rendering
// ---------------------------------------------------------------------------

export function renderWearableForPrompt(snap: WearableSignalSnapshot): string {
  if (snap.readinessSource === 'none') return '';

  const lines: string[] = ['', 'WEARABLE SIGNALS (auto-populated for today):'];

  if (snap.lastNightSleepHrs != null) {
    let sleepLine = `- last night sleep: ${snap.lastNightSleepHrs.toFixed(1)} hrs`;
    if (snap.sleepDebtHrs != null) {
      const tag =
        snap.sleepDebtHrs <= -1
          ? ` (${Math.abs(snap.sleepDebtHrs).toFixed(1)} hrs BELOW 7-day mean — sleep debt)`
          : snap.sleepDebtHrs >= 1
            ? ` (${snap.sleepDebtHrs.toFixed(1)} hrs above 7-day mean)`
            : ` (within ±1 hr of 7-day mean)`;
      sleepLine += tag;
    }
    lines.push(sleepLine);
  }

  if (snap.hrv != null) {
    let hrvLine = `- HRV: ${snap.hrv.toFixed(0)} ms`;
    if (snap.hrvBaseline7d != null) {
      const delta = ((snap.hrv - snap.hrvBaseline7d) / snap.hrvBaseline7d) * 100;
      const tag =
        Math.abs(delta) < 5
          ? ` (within ±5% of 7-day mean ${snap.hrvBaseline7d.toFixed(0)} ms)`
          : delta < 0
            ? ` (${delta.toFixed(0)}% below 7-day mean ${snap.hrvBaseline7d.toFixed(0)} ms — recovery flag)`
            : ` (${delta.toFixed(0)}% above 7-day mean — well-recovered)`;
      hrvLine += tag;
    }
    lines.push(hrvLine);
  }

  if (snap.readinessScore != null) {
    const sourceTag = snap.readinessSource === 'provider' ? 'wearable' : 'derived';
    lines.push(`- readiness: ${snap.readinessScore}/100 (${sourceTag})`);
  }

  // Coaching directive — what should Gunny DO with this?
  lines.push(
    'Apply these to today\'s basis (basis.sleepDebtHrs, basis.readinessScore). If readiness < 60 OR sleep_debt < -1, soften the workout block (move to lighter session if available), cap caffeine to the lower end of the range, and bring the wind_down + sleep_target 30 min earlier. If readiness > 80 AND sleep_debt > 0, full intensity is on the table.',
  );

  return lines.join('\n');
}
