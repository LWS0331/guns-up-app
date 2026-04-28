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
import { requireCronAuth } from '@/lib/cronAuth';

const RECENT_WINDOW_DAYS = 28;
const ACUTE_DAYS = 7;
const CHRONIC_DAYS = 28;
const HRV_BASELINE_DAYS = 14;     // standard rolling-mean window for HRV
const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface Workout {
  date?: string;
  sessionRpe?: number;
  sessionDurationMin?: number;
  completed?: boolean;
}

interface SnapshotRow {
  syncDate: string;
  hrv: number | null;
  restingHr: number | null;
  sleepHours: number | null;
  sleepEfficiency: number | null;
  recoveryScore: number | null;
}

export async function GET(req: NextRequest) {
  // Bearer auth — fails closed in production. See src/lib/cronAuth.ts
  // for why this is a separate helper now (the inline pattern was
  // fail-OPEN on missing env var; an audit caught the backdoor).
  const denied = requireCronAuth(req);
  if (denied) return denied;

  try {
    const startedAt = new Date();
    const cutoff = new Date(startedAt.getTime() - RECENT_WINDOW_DAYS * MS_PER_DAY);
    const cutoffDateStr = cutoff.toISOString().slice(0, 10);

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

    // True rolling baselines (v2): pull WearableSnapshot rows for the
    // last 28 days, group by operator. Each row is one calendar day
    // with explicit columns (hrv, restingHr, sleepHours, etc.) written
    // by the webhook. This replaces the v1 incremental-mean approximation
    // that treated each cron run as one data point.
    const snapshots = await prisma.wearableSnapshot.findMany({
      where: { syncDate: { gte: cutoffDateStr } },
      orderBy: { syncDate: 'asc' },
      select: {
        operatorId: true,
        syncDate: true,
        hrv: true,
        restingHr: true,
        sleepHours: true,
        sleepEfficiency: true,
        recoveryScore: true,
      },
    });
    const snapshotsByOp = new Map<string, SnapshotRow[]>();
    for (const s of snapshots) {
      const list = snapshotsByOp.get(s.operatorId) ?? [];
      list.push(s);
      snapshotsByOp.set(s.operatorId, list);
    }

    // Legacy fallback: operators who haven't accumulated WearableSnapshot
    // rows yet (e.g. closed-beta users on the day this ships) still get a
    // single-point read from WearableConnection.syncData. After ~14 days
    // of webhook activity the snapshot path takes over fully.
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
      const result = await updateBaselineFor(
        op.id,
        op.workouts,
        snapshotsByOp.get(op.id) ?? [],
        wearableByOp.get(op.id),
        cutoff,
      );
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
  snapshotRows: SnapshotRow[],
  legacyWearable: { syncData: unknown; lastSyncAt: Date | null } | undefined,
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

  // ── Wearable signals: prefer WearableSnapshot rows, fall back to
  //    the legacy single-point WearableConnection.syncData read for
  //    operators with zero snapshot history. ──
  let hrvSamples: number[] = [];
  let rhrSamples: number[] = [];
  let sleepSamples: number[] = [];
  let baselineDays = 0;

  if (snapshotRows.length > 0) {
    // Take the most recent HRV_BASELINE_DAYS samples for HRV/RHR/sleep.
    // Use slice from the end since rows are ordered by syncDate ASC.
    const recent = snapshotRows.slice(-HRV_BASELINE_DAYS);
    for (const r of recent) {
      if (r.hrv != null) hrvSamples.push(r.hrv);
      if (r.restingHr != null) rhrSamples.push(r.restingHr);
      if (r.sleepHours != null) sleepSamples.push(r.sleepHours);
    }
    // baselineDays = distinct calendar days with ANY readiness-relevant
    // signal. This matches what readinessScore() expects (it gates the
    // confidence tiers off baselineDays).
    const distinctDates = new Set<string>();
    for (const r of snapshotRows) {
      if (r.hrv != null || r.restingHr != null || r.sleepHours != null || r.recoveryScore != null) {
        distinctDates.add(r.syncDate);
      }
    }
    baselineDays = distinctDates.size;
  } else if (legacyWearable) {
    // Legacy single-point fallback. New ops who sync today but haven't
    // accumulated history yet still register one day of data so the
    // engine starts the cold-start clock.
    const syncData = (legacyWearable.syncData || {}) as Record<string, unknown>;
    const sleep = (syncData.sleep || {}) as Record<string, unknown>;
    const recovery = (syncData.recovery || {}) as Record<string, unknown>;
    const hrv = typeof recovery.hrv === 'number' ? Number(recovery.hrv) : null;
    const rhr = typeof recovery.restingHr === 'number' ? Number(recovery.restingHr) : null;
    // syncData.sleep.duration is stored in HOURS (see webhook + sync).
    // The v1 cron divided by 3600 here as if it were seconds — that
    // bug's been carried since the engine launched. Fixed in the
    // snapshot read above (column is named sleepHours and stored in
    // hours); fixing it on the legacy path too so the transition
    // period doesn't undercount sleep.
    const sleepH = typeof sleep.duration === 'number' ? Number(sleep.duration) : null;
    if (hrv != null) hrvSamples = [hrv];
    if (rhr != null) rhrSamples = [rhr];
    if (sleepH != null) sleepSamples = [sleepH];
    baselineDays = (hrv != null || rhr != null || sleepH != null) ? 1 : 0;
  }

  // If we have nothing — no completed workouts, no wearable — skip.
  if (recentLoads.length === 0 && hrvSamples.length === 0 && rhrSamples.length === 0 && sleepSamples.length === 0) {
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

  // ── Wearable rolling means + SDs from the actual sample arrays ──
  const newHrvMean = mean(hrvSamples);
  const newHrvSD = hrvSamples.length > 1 ? stddev(hrvSamples) : null;
  const newRhrMean = mean(rhrSamples);
  const newSleepMean = mean(sleepSamples);

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
      baselineDays,
      lastComputedAt: new Date(),
    },
    create: {
      operatorId,
      hrvRollingMean: newHrvMean,
      hrvRollingSD: newHrvSD,
      rhrRollingMean: newRhrMean,
      sleepHoursMean: newSleepMean,
      sRpeMean,
      sRpeSD,
      acuteLoad7d: acuteSum,
      chronicLoad28d: chronicLoads.length > 0 ? chronicSum / Math.min(chronicLoads.length, CHRONIC_DAYS) : null,
      acwr,
      baselineDays,
      lastComputedAt: new Date(),
    },
  });
  return 'updated';
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[]): number {
  const m = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}
