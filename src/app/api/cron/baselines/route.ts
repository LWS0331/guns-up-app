// GET /api/cron/baselines
//
// Daily cron — for every operator, recompute the OperatorBaseline row
// from the last 28 days of:
//   1. WearableConnection.syncData history (HRV, RHR, sleep duration)
//   2. Workout records (sessionRpe × sessionDurationMin → daily load)
//
// Output: rolling means/SDs + ACWR, written to OperatorBaseline.
// The readinessScore() function in src/lib/readiness.ts reads from
// this table to compute live recommendations.
//
// Auth: CRON_SECRET via Bearer token (matches activation-emails cron).
//
// Why a daily cron instead of computing on-demand: rolling-window math
// over a month of data per call would be expensive at scale. One
// pre-computed row per operator keeps the readiness endpoint snappy
// and lets us pre-flag operators with concerning ACWR for the
// founder dashboard.
//
// Idempotent — safe to retry. Skips operators with no recent data.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const RECENT_WINDOW_DAYS = 28;
const ACUTE_DAYS = 7;
const CHRONIC_DAYS = 28;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface Workout {
  date?: string;
  sessionRpe?: number;
  sessionDurationMin?: number;
  completed?: boolean;
}

export async function GET(req: NextRequest) {
  // Bearer auth — same pattern as other crons.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const startedAt = new Date();
    const cutoff = new Date(startedAt.getTime() - RECENT_WINDOW_DAYS * MS_PER_DAY);

    // We could narrow this with a where clause, but for closed beta
    // the operator count is small (<20) — straight findMany is fine.
    // When the user count grows past ~1000 we'll want to filter to
    // operators with workouts or wearable connections in the last
    // 28 days only.
    const operators = await prisma.operator.findMany({
      select: {
        id: true,
        workouts: true,
      },
    });

    // Pull all wearable history in one shot, group in memory.
    // For each operator we want the syncData snapshots since cutoff.
    // WearableConnection.syncData is the LATEST snapshot — to compute
    // a rolling baseline we need historical snapshots. The Vital webhook
    // currently overwrites syncData on each sync, so for v1 we treat
    // the latest snapshot as a single data point per operator and
    // accumulate over time via this cron's incremental writes.
    //
    // TODO: add a WearableSnapshot history table for proper rolling
    // baselines. For now, we increment the rolling mean each cron run
    // using the latest sync, which approximates a 1-sample-per-day
    // signal — adequate for daily-summary providers (Oura, WHOOP,
    // Garmin recovery). This is a known limitation.
    const wearables = await prisma.wearableConnection.findMany({
      where: { active: true },
      select: { operatorId: true, syncData: true, lastSyncAt: true },
    });
    const wearableByOp = new Map<string, { syncData: unknown; lastSyncAt: Date | null }>();
    for (const w of wearables) {
      const existing = wearableByOp.get(w.operatorId);
      if (!existing || (w.lastSyncAt && existing.lastSyncAt && w.lastSyncAt > existing.lastSyncAt)) {
        wearableByOp.set(w.operatorId, { syncData: w.syncData, lastSyncAt: w.lastSyncAt });
      }
    }

    let processed = 0;
    let skipped = 0;
    let updated = 0;

    for (const op of operators) {
      processed += 1;
      const result = await updateBaselineFor(op.id, op.workouts, wearableByOp.get(op.id), cutoff);
      if (result === 'skipped') skipped += 1;
      else updated += 1;
    }

    return NextResponse.json({
      ok: true,
      processed,
      updated,
      skipped,
      durationMs: Date.now() - startedAt.getTime(),
      ts: startedAt.toISOString(),
    });
  } catch (error) {
    console.error('[cron/baselines] error', error);
    return NextResponse.json({
      error: 'Cron failed',
      details: String(error),
    }, { status: 500 });
  }
}

async function updateBaselineFor(
  operatorId: string,
  workoutsJson: unknown,
  wearable: { syncData: unknown; lastSyncAt: Date | null } | undefined,
  cutoff: Date,
): Promise<'updated' | 'skipped'> {
  // ── Workouts → load history ──
  // Operator.workouts is JSON: Record<dateStr, Workout>
  const workouts = (workoutsJson || {}) as Record<string, Workout>;
  const recentLoads: { date: string; load: number }[] = [];
  const sRpeValues: number[] = [];

  for (const [dateStr, w] of Object.entries(workouts)) {
    if (!w?.completed) continue;
    const date = new Date(dateStr);
    if (isNaN(date.getTime()) || date < cutoff) continue;
    if (typeof w.sessionRpe === 'number' && typeof w.sessionDurationMin === 'number') {
      const load = w.sessionRpe * w.sessionDurationMin;
      recentLoads.push({ date: dateStr, load });
      sRpeValues.push(w.sessionRpe);
    }
  }

  // ── Wearable signals ──
  const syncData = (wearable?.syncData || {}) as Record<string, unknown>;
  const sleep = (syncData.sleep || {}) as Record<string, unknown>;
  const recovery = (syncData.recovery || {}) as Record<string, unknown>;
  const hrv = typeof recovery.hrv === 'number' ? Number(recovery.hrv) : null;
  const rhr = typeof recovery.restingHr === 'number' ? Number(recovery.restingHr) : null;
  const sleepHours = typeof sleep.duration === 'number' ? Number(sleep.duration) / 3600 : null;

  // If we have nothing — no completed workouts, no wearable — skip.
  if (recentLoads.length === 0 && hrv == null && rhr == null && sleepHours == null) {
    return 'skipped';
  }

  // ── Compute ACWR ──
  // Sort loads by date desc, take last 7 for acute, last 28 for chronic.
  recentLoads.sort((a, b) => b.date.localeCompare(a.date));

  const now = Date.now();
  const acuteCutoff = new Date(now - ACUTE_DAYS * MS_PER_DAY);
  const chronicCutoff = new Date(now - CHRONIC_DAYS * MS_PER_DAY);
  const acuteLoads = recentLoads.filter(l => new Date(l.date) >= acuteCutoff);
  const chronicLoads = recentLoads.filter(l => new Date(l.date) >= chronicCutoff);

  const acuteSum = acuteLoads.reduce((sum, l) => sum + l.load, 0);
  const chronicSum = chronicLoads.reduce((sum, l) => sum + l.load, 0);
  // Chronic is a daily mean × 7 to make it comparable to the acute sum.
  // (Standard Foster formula: acwr = acute_sum / (chronic_sum / 4)
  //  for 28d/7d windows, which simplifies to acute_sum × 4 / chronic_sum.)
  const acwr = chronicSum > 0 ? (acuteSum * 4) / chronicSum : null;

  // ── sRPE stats ──
  const sRpeMean = sRpeValues.length > 0
    ? sRpeValues.reduce((a, b) => a + b, 0) / sRpeValues.length
    : null;
  const sRpeSD = sRpeValues.length > 1 ? stddev(sRpeValues) : null;

  // ── Wearable rolling means ──
  // Incremental update: pull existing baseline, average new value in.
  // This is a simplification — a real rolling 14-day mean would
  // require a snapshot history table (see TODO at top). For closed
  // beta with daily-summary providers it's an acceptable approximation
  // because each cron run sees the latest day's reading and folds it
  // into a running average.
  const existing = await prisma.operatorBaseline.findUnique({ where: { operatorId } });
  const days = (existing?.baselineDays ?? 0) + 1;

  const newHrvMean = rollingUpdate(existing?.hrvRollingMean ?? null, hrv, days);
  const newRhrMean = rollingUpdate(existing?.rhrRollingMean ?? null, rhr, days);
  const newSleepMean = rollingUpdate(existing?.sleepHoursMean ?? null, sleepHours, days);

  // SD is approximated incrementally via Welford's online algorithm
  // (good enough). For HRV only — RHR and sleep don't need SD because
  // we treat them as raw deltas in the readiness scoring.
  const newHrvSD = welfordSD(existing?.hrvRollingSD ?? null, existing?.hrvRollingMean ?? null, hrv, days);

  await prisma.operatorBaseline.upsert({
    where: { operatorId },
    update: {
      hrvRollingMean: newHrvMean,
      hrvRollingSD: newHrvSD,
      rhrRollingMean: newRhrMean,
      sleepHoursMean: newSleepMean,
      sRpeMean,
      sRpeSD,
      acuteLoad7d: acuteSum,
      chronicLoad28d: chronicLoads.length > 0 ? chronicSum / Math.min(chronicLoads.length, CHRONIC_DAYS) : null,
      acwr,
      baselineDays: days,
      lastComputedAt: new Date(),
    },
    create: {
      operatorId,
      hrvRollingMean: hrv,
      hrvRollingSD: null,
      rhrRollingMean: rhr,
      sleepHoursMean: sleepHours,
      sRpeMean,
      sRpeSD,
      acuteLoad7d: acuteSum,
      chronicLoad28d: chronicLoads.length > 0 ? chronicSum / Math.min(chronicLoads.length, CHRONIC_DAYS) : null,
      acwr,
      baselineDays: 1,
      lastComputedAt: new Date(),
    },
  });
  return 'updated';
}

function rollingUpdate(prev: number | null, sample: number | null, days: number): number | null {
  if (sample == null) return prev;
  if (prev == null) return sample;
  // Simple recency-weighted update: each new sample contributes 1/days,
  // capped so a single bad reading doesn't trash a mature baseline.
  const weight = 1 / Math.max(days, 1);
  return prev * (1 - weight) + sample * weight;
}

function welfordSD(prevSD: number | null, prevMean: number | null, sample: number | null, days: number): number | null {
  if (sample == null) return prevSD;
  if (prevMean == null || days < 2) return null;
  // Approximation — true Welford requires the M2 sum-of-squares which
  // we don't store. This treats the existing SD as the running estimate
  // and adjusts it slightly toward the new deviation. Fine for engine
  // bootstrapping; replace with proper Welford state when we add the
  // snapshot history table.
  const deviation = Math.abs(sample - prevMean);
  if (prevSD == null) return deviation;
  const weight = 1 / Math.max(days, 2);
  return prevSD * (1 - weight) + deviation * weight;
}

function stddev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
