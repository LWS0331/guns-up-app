// PersonalRhythm — 14-day rolling feedback aggregator for Daily Ops.
//
// Phase 2A. Reads DailyOpsPlan.feedback across the operator's last
// 14 days, derives the operator's actual rhythm vs Gunny's defaults,
// and persists to the PersonalRhythm row. Called lazily right before
// each plan generation in /api/gunny so the next plan can adapt.
//
// This is INTENTIONALLY heuristic. We're not training a model — we're
// just translating "the operator marked caffeine_cutoff as too_early
// 4 times in the last 14 days" into "default the cutoff 60 min later".
// The signal is good enough to feel responsive without overfitting on
// a small sample.

import { prisma } from '@/lib/db';
import type { Prisma } from '@/generated/prisma/client';
import type {
  DailyBlock,
  BlockCategory,
  BlockFeedback,
  PerceivedFit,
} from '@/lib/dailyOpsTypes';

// ---------------------------------------------------------------------------
// Tunables — single source of truth. Easy to revisit if the rhythm
// feels too aggressive or too sluggish in production.
// ---------------------------------------------------------------------------

const ROLLING_WINDOW_DAYS = 14;
const VOTE_TOO_EARLY_MIN = 60;   // each "too_early" vote shifts +60 min later
const VOTE_TOO_LATE_MIN = -30;   // each "too_late" vote shifts -30 min earlier
const CLAMP_OFFSET_MIN = 180;    // never let a single block drift more than 3 hrs from default
const MIN_SAMPLES_FOR_OFFSET = 2; // need ≥2 votes before we update the default

export interface PersonalRhythmShape {
  operatorId: string;
  caffeineCutoffOffsetMin: number;
  workoutWindowDefault: string | null;
  windDownOffsetMin: number;
  bedtimeOffsetMin: number;
  blockSkipRates: Record<string, number>; // BlockCategory → 0..1
  preferredMealCount: number;
  sleepGapMin: number;
  feedbackSampleCount: number;
  lastComputedAt: string | null;
}

// ---------------------------------------------------------------------------
// Time helpers — keep all math in minutes-since-midnight to avoid
// timezone / Date-object bugs. The block.startTime is already 'HH:MM'.
// ---------------------------------------------------------------------------

function hhmmToMin(s: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const h = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

function minToHhmm(min: number): string {
  const wrapped = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function modeOf<T>(arr: T[]): T | null {
  if (arr.length === 0) return null;
  const counts = new Map<T, number>();
  let bestKey: T | null = null;
  let bestCount = 0;
  for (const v of arr) {
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      bestCount = c;
      bestKey = v;
    }
  }
  return bestKey;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

// ---------------------------------------------------------------------------
// Vote scoring — translate one BlockFeedback into a time-shift vote.
// ---------------------------------------------------------------------------

function shiftVote(fit: PerceivedFit | undefined): number {
  if (fit === 'too_early') return VOTE_TOO_EARLY_MIN;
  if (fit === 'too_late') return VOTE_TOO_LATE_MIN;
  return 0;
}

// ---------------------------------------------------------------------------
// Core aggregator — pure function over plan rows. Tested implicitly
// via the upsert path (see callers in /api/gunny).
// ---------------------------------------------------------------------------

interface PlanRow {
  date: string;
  blocks: DailyBlock[];
  feedback: Record<string, BlockFeedback>;
}

function summarizePlans(plans: PlanRow[]): {
  votes: Record<BlockCategory, number[]>;
  followed: Record<BlockCategory, { yes: number; no: number; partial: number }>;
  workoutTimes: string[];
  mealCounts: number[];
  totalFeedbackEntries: number;
} {
  const votes: Record<string, number[]> = {};
  const followed: Record<string, { yes: number; no: number; partial: number }> = {};
  const workoutTimes: string[] = [];
  const mealCounts: number[] = [];
  let totalFeedbackEntries = 0;

  for (const plan of plans) {
    const planMealCount = plan.blocks.filter((b) => b.category === 'meal').length;
    if (planMealCount > 0) mealCounts.push(planMealCount);

    for (const block of plan.blocks) {
      const fb = plan.feedback[block.id];
      if (!fb) continue;
      totalFeedbackEntries++;

      const c = block.category;
      if (!votes[c]) votes[c] = [];
      if (!followed[c]) followed[c] = { yes: 0, no: 0, partial: 0 };

      // Time-shift vote (only meaningful when fit is reported).
      const v = shiftVote(fb.perceivedFit);
      if (v !== 0) votes[c].push(v);

      // Adherence bucket.
      followed[c][fb.followed]++;

      // Workout time learning — collect 'on time' workout starts.
      if (
        block.category === 'workout' &&
        fb.followed === 'yes' &&
        (fb.perceivedFit === 'right' || !fb.perceivedFit)
      ) {
        workoutTimes.push(block.startTime);
      }
    }
  }

  return {
    votes: votes as Record<BlockCategory, number[]>,
    followed: followed as Record<BlockCategory, { yes: number; no: number; partial: number }>,
    workoutTimes,
    mealCounts,
    totalFeedbackEntries,
  };
}

function deriveOffset(votes: number[]): number {
  if (votes.length < MIN_SAMPLES_FOR_OFFSET) return 0;
  const sum = votes.reduce((s, v) => s + v, 0);
  return clamp(Math.round(sum / votes.length), -CLAMP_OFFSET_MIN, CLAMP_OFFSET_MIN);
}

function deriveSkipRate(stat: { yes: number; no: number; partial: number } | undefined): number {
  if (!stat) return 0;
  const total = stat.yes + stat.no + stat.partial;
  if (total === 0) return 0;
  return Number((stat.no / total).toFixed(2));
}

// ---------------------------------------------------------------------------
// Wearable-derived sleep gap — pulled in here (not in wearableSignals.ts)
// because it's a 14-day rolling delta, not a same-day reading.
// ---------------------------------------------------------------------------

async function computeSleepGapMin(operatorId: string, plans: PlanRow[]): Promise<number> {
  if (plans.length === 0) return 0;
  const dateRange = plans.map((p) => p.date);
  const snaps = await prisma.wearableSnapshot.findMany({
    where: {
      operatorId,
      syncDate: { in: dateRange },
      sleepHours: { not: null },
    },
    select: { syncDate: true, sleepHours: true },
  });
  if (snaps.length === 0) return 0;

  const sleepBySyncDate = new Map<string, number>();
  for (const s of snaps) {
    if (s.sleepHours != null) sleepBySyncDate.set(s.syncDate, s.sleepHours);
  }

  // For each plan that had a sleep_target block, compute planned hours
  // and compare with the wearable reading from the SAME calendar date
  // (since the wearable's syncDate is the wake-up date, which matches
  // the plan's date).
  const gaps: number[] = [];
  for (const plan of plans) {
    const sleepBlock = plan.blocks.find((b) => b.category === 'sleep_target');
    if (!sleepBlock) continue;
    const start = hhmmToMin(sleepBlock.startTime);
    const end = sleepBlock.endTime ? hhmmToMin(sleepBlock.endTime) : null;
    if (start === null || end === null) continue;
    // Sleep crosses midnight: if end < start, add 24h to end.
    const plannedMin = end < start ? end + 1440 - start : end - start;
    const actual = sleepBySyncDate.get(plan.date);
    if (actual == null) continue;
    const actualMin = Math.round(actual * 60);
    gaps.push(actualMin - plannedMin);
  }

  if (gaps.length === 0) return 0;
  const mean = gaps.reduce((s, v) => s + v, 0) / gaps.length;
  return clamp(Math.round(mean), -300, 60); // clamp -5h..+1h sanity range
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Recompute and persist the PersonalRhythm row for an operator.
 * Idempotent — call as many times as you like; pure derived state.
 */
export async function recomputePersonalRhythm(operatorId: string): Promise<PersonalRhythmShape> {
  // Pull last 14 days of plans.
  const since = new Date();
  since.setDate(since.getDate() - ROLLING_WINDOW_DAYS);
  const sinceISO = since.toISOString().slice(0, 10);

  const planRows = await prisma.dailyOpsPlan.findMany({
    where: {
      operatorId,
      date: { gte: sinceISO },
    },
    select: { date: true, blocks: true, feedback: true },
    orderBy: { date: 'desc' },
    take: ROLLING_WINDOW_DAYS,
  });

  const plans: PlanRow[] = planRows.map((p) => ({
    date: p.date,
    blocks: Array.isArray(p.blocks) ? (p.blocks as unknown as DailyBlock[]) : [],
    feedback:
      p.feedback && typeof p.feedback === 'object' && !Array.isArray(p.feedback)
        ? (p.feedback as unknown as Record<string, BlockFeedback>)
        : {},
  }));

  const summary = summarizePlans(plans);

  const caffeineCutoffOffsetMin = deriveOffset(summary.votes['caffeine_cutoff'] ?? []);
  const windDownOffsetMin = deriveOffset(summary.votes['wind_down'] ?? []);
  const bedtimeOffsetMin = deriveOffset(summary.votes['sleep_target'] ?? []);
  const workoutWindowDefault = modeOf(summary.workoutTimes);

  const skipRates: Record<string, number> = {};
  for (const cat of Object.keys(summary.followed)) {
    skipRates[cat] = deriveSkipRate(summary.followed[cat as BlockCategory]);
  }

  const preferredMealCount = modeOf(summary.mealCounts) ?? 4;
  const sleepGapMin = await computeSleepGapMin(operatorId, plans);

  const computedAt = new Date();

  const persisted = await prisma.personalRhythm.upsert({
    where: { operatorId },
    create: {
      operatorId,
      caffeineCutoffOffsetMin,
      workoutWindowDefault,
      windDownOffsetMin,
      bedtimeOffsetMin,
      blockSkipRates: skipRates as unknown as Prisma.InputJsonValue,
      preferredMealCount,
      sleepGapMin,
      feedbackSampleCount: summary.totalFeedbackEntries,
      lastComputedAt: computedAt,
    },
    update: {
      caffeineCutoffOffsetMin,
      workoutWindowDefault,
      windDownOffsetMin,
      bedtimeOffsetMin,
      blockSkipRates: skipRates as unknown as Prisma.InputJsonValue,
      preferredMealCount,
      sleepGapMin,
      feedbackSampleCount: summary.totalFeedbackEntries,
      lastComputedAt: computedAt,
    },
  });

  return {
    operatorId: persisted.operatorId,
    caffeineCutoffOffsetMin: persisted.caffeineCutoffOffsetMin,
    workoutWindowDefault: persisted.workoutWindowDefault,
    windDownOffsetMin: persisted.windDownOffsetMin,
    bedtimeOffsetMin: persisted.bedtimeOffsetMin,
    blockSkipRates:
      (persisted.blockSkipRates as unknown as Record<string, number>) ?? {},
    preferredMealCount: persisted.preferredMealCount,
    sleepGapMin: persisted.sleepGapMin,
    feedbackSampleCount: persisted.feedbackSampleCount,
    lastComputedAt: persisted.lastComputedAt?.toISOString() ?? null,
  };
}

/**
 * Read-only fetch — no recomputation. For surfaces that just want the
 * current snapshot (admin views, debug tools).
 */
export async function getPersonalRhythm(operatorId: string): Promise<PersonalRhythmShape | null> {
  const row = await prisma.personalRhythm.findUnique({ where: { operatorId } });
  if (!row) return null;
  return {
    operatorId: row.operatorId,
    caffeineCutoffOffsetMin: row.caffeineCutoffOffsetMin,
    workoutWindowDefault: row.workoutWindowDefault,
    windDownOffsetMin: row.windDownOffsetMin,
    bedtimeOffsetMin: row.bedtimeOffsetMin,
    blockSkipRates:
      (row.blockSkipRates as unknown as Record<string, number>) ?? {},
    preferredMealCount: row.preferredMealCount,
    sleepGapMin: row.sleepGapMin,
    feedbackSampleCount: row.feedbackSampleCount,
    lastComputedAt: row.lastComputedAt?.toISOString() ?? null,
  };
}

// ---------------------------------------------------------------------------
// Render to a Gunny-prompt-ready text block.
//
// Goal: < 25 lines, dense, scannable. Gunny uses this to adapt the
// next plan — it's NOT shown to the user directly.
// ---------------------------------------------------------------------------

export function renderRhythmForPrompt(rhythm: PersonalRhythmShape | null): string {
  if (!rhythm || rhythm.feedbackSampleCount < 3) {
    return ''; // Not enough signal yet — don't pollute the prompt.
  }

  const lines: string[] = ['', 'PERSONAL RHYTHM (last 14 days, derived from operator feedback):'];

  const fmtOffset = (m: number) => {
    if (m === 0) return null;
    const sign = m > 0 ? '+' : '';
    return `${sign}${m} min`;
  };

  if (rhythm.caffeineCutoffOffsetMin !== 0) {
    const off = fmtOffset(rhythm.caffeineCutoffOffsetMin);
    lines.push(`- caffeine_cutoff: shift ${off} from default (operator feedback)`);
  }
  if (rhythm.windDownOffsetMin !== 0) {
    lines.push(`- wind_down: shift ${fmtOffset(rhythm.windDownOffsetMin)} from default`);
  }
  if (rhythm.bedtimeOffsetMin !== 0) {
    lines.push(`- sleep_target: shift ${fmtOffset(rhythm.bedtimeOffsetMin)} from default`);
  }
  if (rhythm.workoutWindowDefault) {
    lines.push(`- workout: operator's preferred start time = ${rhythm.workoutWindowDefault}`);
  }
  if (rhythm.preferredMealCount !== 4) {
    lines.push(`- meal cadence: operator prefers ${rhythm.preferredMealCount} meals (vs default 4)`);
  }
  if (rhythm.sleepGapMin < -30) {
    lines.push(
      `- sleep gap: operator sleeping ~${Math.abs(rhythm.sleepGapMin)} min less than the planned target — consider an earlier wind_down or earlier sleep_target`,
    );
  }

  // High-skip categories — Gunny should drop them or reframe them.
  const HIGH_SKIP_THRESHOLD = 0.6;
  const highSkip: string[] = [];
  for (const [cat, rate] of Object.entries(rhythm.blockSkipRates)) {
    if (rate >= HIGH_SKIP_THRESHOLD) highSkip.push(`${cat} (${Math.round(rate * 100)}% skipped)`);
  }
  if (highSkip.length > 0) {
    lines.push(
      `- high-skip blocks (consider dropping or softening): ${highSkip.join(', ')}`,
    );
  }

  lines.push(
    `- sample size: ${rhythm.feedbackSampleCount} feedback entries across the rolling 14-day window`,
  );

  // Coaching directive — last line tells Gunny what to do with the
  // rhythm so it's not just data sitting in the prompt.
  lines.push(
    'When generating today\'s plan, apply these offsets as the new default startTimes. The operator gave this feedback — honor it. If the operator wants to revert, they can ask explicitly.',
  );

  return lines.join('\n');
}

export {
  hhmmToMin as _hhmmToMin,
  minToHhmm as _minToHhmm,
};
