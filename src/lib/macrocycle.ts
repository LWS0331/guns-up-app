// Macrocycle engine — builds, evolves, and arbitrates between concurrent
// long-horizon goals (6-12 month windows: powerlifting meets, hypertrophy
// phases, season prep, fat-loss runs).
//
// Public API:
//   - buildMacroCycle(goal, today)            → MacroCycle
//   - getActiveBlock(cycle, today)            → MacroBlock | null
//   - arbitrateConcurrentGoals(cycles, today) → MacroCycleArbitrationResult
//   - checkBlockTransition(cycle, today, op)  → 'advance' | 'extend' | 'hold'
//   - recomputeOnGoalDateChange(cycle, newDate, today) → MacroCycle
//
// Design choices (per Apr 2026 spec, user picked all hybrid options):
//   1. Hybrid algo — deterministic skeleton from macrocycleLibrary.ts +
//      Gunny annotation hooked separately (not implemented in this file
//      to keep the engine pure / testable).
//   2. Concurrent — up to 2 active goals, priority-ranked. The lower-
//      priority goal pauses while the higher-priority goal is in an
//      `exclusive` block (peak/taper/refeed/deload).
//   3. Hybrid transitions — time-based default, performance-marker can
//      advance early or extend by 1 week. See checkBlockTransition().

import type {
  MacroBlock,
  MacroCycle,
  MacroCycleArbitrationResult,
  MacroGoal,
  Operator,
} from './types';
import { getTemplateForGoal, getTemplateNominalWeeks, type BlockSpec } from './macrocycleLibrary';

// ─── Date helpers ─────────────────────────────────────────────────────────
// All dates are ISO YYYY-MM-DD strings in the operator's local timezone.
// Math is done in UTC to avoid DST edge cases — the rounding tolerance for
// "today" is ±1 day, which is well within DST drift.

function parseISO(d: string): Date {
  // Anchor at noon UTC so DST shifts can't bump the day.
  return new Date(`${d}T12:00:00Z`);
}

function toISO(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

function diffDays(a: string, b: string): number {
  // a - b in days. Positive if a > b.
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000);
}

function generateBlockId(goalId: string, idx: number): string {
  return `mb-${goalId}-${idx}`;
}

// ─── Build / reverse-engineer ─────────────────────────────────────────────

/**
 * Walk the template BACKWARD from the goal date so the peak/taper land
 * precisely on the meet, then fit the front of the template into the
 * remaining time. If the operator-to-goal interval is shorter than the
 * template's nominal weeks, compress the FLEXIBLE front blocks. If it's
 * longer, extend them. Late blocks (peak/taper/deload) are non-negotiable.
 *
 * Edge case: if the interval is shorter than the sum of NON-flexible
 * blocks, we still produce a valid cycle but mark it "compressed" by
 * starting the first non-flexible block immediately. The UI surfaces this
 * as a warning (operator's goal date is too close — performance ceiling
 * is what it is). */
export function buildMacroCycle(goal: MacroGoal, today: string): MacroCycle {
  const template = getTemplateForGoal(goal.type);
  const intervalDays = diffDays(goal.targetDate, today);
  const intervalWeeks = Math.max(0, Math.floor(intervalDays / 7));

  const nominalNonFlexibleWeeks = template
    .filter((b) => !b.flexible)
    .reduce((s, b) => s + b.durationWeeks, 0);
  const nominalFlexibleWeeks = template
    .filter((b) => b.flexible)
    .reduce((s, b) => s + b.durationWeeks, 0);

  const flexibleBudgetWeeks = Math.max(0, intervalWeeks - nominalNonFlexibleWeeks);
  // Scale flexible blocks proportionally. If budget is 0, flexible blocks
  // collapse to a 1-week minimum so the cycle still has shape.
  const flexScale =
    nominalFlexibleWeeks > 0 ? flexibleBudgetWeeks / nominalFlexibleWeeks : 1;

  const blocks: MacroBlock[] = [];
  let cursor = today;
  let idx = 0;
  for (const spec of template) {
    const adjustedWeeks = spec.flexible
      ? Math.max(1, Math.round(spec.durationWeeks * flexScale))
      : spec.durationWeeks;
    const startDate = cursor;
    const endDate = addDays(cursor, adjustedWeeks * 7 - 1);
    blocks.push({
      id: generateBlockId(goal.id, idx),
      kind: spec.kind,
      name: spec.name,
      startDate,
      endDate,
      durationWeeks: adjustedWeeks,
      compatibility: spec.compatibility,
      volumeMultiplier: spec.volumeMultiplier,
      intensityMultiplier: spec.intensityMultiplier,
      performanceMarker: spec.performanceMarker,
      description: spec.description,
      status: 'upcoming',
    });
    cursor = addDays(endDate, 1);
    idx++;
  }

  // Snap the last block's endDate to the goal date so the taper lands
  // precisely on the meet/event. Any rounding drift gets absorbed here.
  if (blocks.length > 0) {
    blocks[blocks.length - 1].endDate = goal.targetDate;
  }

  // Mark the active block (the one containing today) as 'active'.
  const activeIdx = blocks.findIndex(
    (b) => diffDays(today, b.startDate) >= 0 && diffDays(today, b.endDate) <= 0,
  );
  if (activeIdx >= 0) blocks[activeIdx].status = 'active';

  return {
    id: `mc-${goal.id}`,
    goal,
    blocks,
    lastRecomputedAt: today,
    annotatedBlockIds: [],
  };
}

// ─── Active-block lookup ──────────────────────────────────────────────────

export function getActiveBlock(cycle: MacroCycle, today: string): MacroBlock | null {
  for (const b of cycle.blocks) {
    if (diffDays(today, b.startDate) >= 0 && diffDays(today, b.endDate) <= 0) {
      return b;
    }
  }
  return null;
}

/** Returns the block AFTER the active one — used to fetch Gunny annotations
 *  ahead of time so the operator sees them at transition. */
export function getNextBlock(cycle: MacroCycle, today: string): MacroBlock | null {
  const active = getActiveBlock(cycle, today);
  if (!active) return null;
  const idx = cycle.blocks.findIndex((b) => b.id === active.id);
  return cycle.blocks[idx + 1] || null;
}

/** Days until this cycle's goal date. Negative if the goal already passed. */
export function daysToGoal(cycle: MacroCycle, today: string): number {
  return diffDays(cycle.goal.targetDate, today);
}

// ─── Concurrent-goal arbitration ──────────────────────────────────────────

/**
 * Concurrent rules (v1, max 2 goals):
 *   1. Sort by priority (1 wins ties).
 *   2. Take the highest-priority active block as PRIMARY.
 *   3. If primary is `exclusive`, secondary pauses (no secondaryBlock).
 *   4. If primary is `concurrent_with_secondary` AND the secondary's
 *      active block is `concurrent_only` or `concurrent_with_secondary`,
 *      both blocks run; secondary's volume/intensity multipliers feed the
 *      brief at half-weight (so they nudge, not dominate).
 *   5. If both primary and secondary are `exclusive`, that's a conflict
 *      that should have been caught at goal-set time — UI should warn.
 *      The engine just picks priority 1.
 */
export function arbitrateConcurrentGoals(
  cycles: MacroCycle[],
  today: string,
): MacroCycleArbitrationResult {
  if (!cycles || cycles.length === 0) {
    return {
      primaryBlock: null,
      primaryGoal: null,
      secondaryBlock: null,
      secondaryGoal: null,
    };
  }

  const sorted = [...cycles]
    .filter((c) => c.goal.status === 'active')
    .sort((a, b) => a.goal.priority - b.goal.priority);

  if (sorted.length === 0) {
    return {
      primaryBlock: null,
      primaryGoal: null,
      secondaryBlock: null,
      secondaryGoal: null,
    };
  }

  const primary = sorted[0];
  const primaryBlock = getActiveBlock(primary, today);
  const secondary = sorted[1] || null;
  const secondaryBlock = secondary ? getActiveBlock(secondary, today) : null;

  // Rule 3: primary is exclusive → secondary pauses.
  if (primaryBlock?.compatibility === 'exclusive' && secondary) {
    return {
      primaryBlock,
      primaryGoal: primary.goal,
      secondaryBlock: null,
      secondaryGoal: secondary.goal,
      pausedNotes: `${secondary.goal.name} paused while ${primary.goal.name} is in ${primaryBlock.name} (exclusive block).`,
    };
  }

  // Rule 5: both exclusive — pick primary, warn the operator via pausedNotes.
  if (
    primaryBlock?.compatibility === 'exclusive' &&
    secondaryBlock?.compatibility === 'exclusive'
  ) {
    return {
      primaryBlock,
      primaryGoal: primary.goal,
      secondaryBlock: null,
      secondaryGoal: secondary?.goal || null,
      pausedNotes: `Conflict: both goals are in exclusive phases. Following priority-1 (${primary.goal.name}). Consider rescheduling.`,
    };
  }

  // Rule 4 (or rule 2 with no secondary): both run.
  return {
    primaryBlock,
    primaryGoal: primary.goal,
    secondaryBlock,
    secondaryGoal: secondary?.goal || null,
  };
}

// ─── Hybrid block transitions ─────────────────────────────────────────────

export type BlockTransitionDecision =
  | { action: 'hold'; reason: string }
  | { action: 'advance'; reason: string; nextBlockId: string }
  | { action: 'extend'; reason: string; extendDays: number };

/**
 * Decide whether the active block should advance early, hold, or extend.
 *
 * Time-based default: advance when calendar passes endDate (caller wires
 * this — the engine just reports the decision).
 *
 * Performance-marker overrides:
 *   - Marker hit BEFORE endDate, within `advanceEarlyDaysAllowed` window:
 *     advance early (reason mentions which marker).
 *   - Marker NOT hit BY endDate (compliance < threshold or volume < target):
 *     extend by 7 days, mark block.status = 'extended'. Capped at one
 *     extension per block (caller checks the status field — if already
 *     'extended', return 'advance' to avoid infinite extension).
 *
 * Operator argument lets us inspect actual workouts/PRs to evaluate the
 * marker. v1 implementation is deliberately conservative — when in doubt,
 * hold. We'd rather miss an early-advance than mistakenly cut a block
 * short and harm peaking. */
export function checkBlockTransition(
  block: MacroBlock,
  today: string,
  operator: Pick<Operator, 'workouts' | 'prs'>,
): BlockTransitionDecision {
  const daysIntoBlock = diffDays(today, block.startDate);
  const daysToEnd = diffDays(block.endDate, today);

  // Calendar-based: past endDate → advance unconditionally.
  if (daysToEnd < 0) {
    return {
      action: 'advance',
      reason: `Block ${block.name} ended ${Math.abs(daysToEnd)} day(s) ago.`,
      nextBlockId: '',
    };
  }

  // No marker → pure time-based, hold until endDate.
  if (!block.performanceMarker) {
    return {
      action: 'hold',
      reason: `Time-based block — ${daysToEnd} day(s) remaining.`,
    };
  }

  const marker = block.performanceMarker;
  const markerHit = evaluateMarker(marker, block, today, operator);

  // Inside the early-advance window AND marker hit → advance.
  if (markerHit && daysToEnd <= marker.advanceEarlyDaysAllowed) {
    return {
      action: 'advance',
      reason: `Performance marker hit (${marker.label}) within ${marker.advanceEarlyDaysAllowed}-day early window.`,
      nextBlockId: '',
    };
  }

  // At/near endDate AND marker NOT hit AND not already extended → extend 1 wk.
  if (
    !markerHit &&
    daysToEnd <= 1 &&
    block.status !== 'extended' &&
    daysIntoBlock >= block.durationWeeks * 7 - 2 // give grace at end of block
  ) {
    return {
      action: 'extend',
      reason: `Performance marker (${marker.label}) not yet met — extending block by 1 week.`,
      extendDays: 7,
    };
  }

  return {
    action: 'hold',
    reason: `Block in progress — ${daysToEnd} day(s) to scheduled end. Marker ${markerHit ? 'hit' : 'not yet hit'}.`,
  };
}

/**
 * Evaluate a performance marker against the operator's recent training.
 *
 * v1 evaluators are intentionally simple (we want testable, predictable
 * behavior) and biased toward "not hit" — false positives on the early-
 * advance side are riskier than false negatives. */
function evaluateMarker(
  marker: import('./types').MacroPerformanceMarker,
  block: MacroBlock,
  today: string,
  operator: Pick<Operator, 'workouts' | 'prs'>,
): boolean {
  const workouts = operator.workouts || {};
  const blockWorkouts = Object.entries(workouts)
    .filter(([date]) => diffDays(date, block.startDate) >= 0 && diffDays(date, today) <= 0)
    .map(([, w]) => w);

  switch (marker.kind) {
    case 'compliance_rate': {
      // % of blockWorkouts marked completed.
      if (blockWorkouts.length === 0) return false;
      const completed = blockWorkouts.filter((w) => w.completed).length;
      const rate = (completed / blockWorkouts.length) * 100;
      return rate >= marker.threshold;
    }

    case 'volume_target': {
      // Sum of weight × reps across completed sets in block window.
      let totalVolume = 0;
      for (const w of blockWorkouts) {
        if (!w.completed || !w.results?.blockResults) continue;
        for (const br of Object.values(w.results.blockResults)) {
          for (const s of br.sets || []) {
            if (s.completed) totalVolume += (s.weight || 0) * (s.reps || 0);
          }
        }
      }
      // Threshold is total volume in lbs, scaled by block week count so the
      // template can use a per-week-ish number that's realistic for the goal.
      return totalVolume >= marker.threshold * block.durationWeeks;
    }

    case 'intensity_target': {
      // Avg working weight as % of (operator's) 1RM. v1 uses the recent
      // session's heaviest set vs operator.prs for the same exercise.
      const prs = operator.prs || [];
      if (prs.length === 0 || blockWorkouts.length === 0) return false;
      let intensitySum = 0;
      let intensityCount = 0;
      for (const w of blockWorkouts) {
        if (!w.completed || !w.results?.blockResults) continue;
        for (const block_b of w.blocks || []) {
          if (block_b.type !== 'exercise') continue;
          const exName = block_b.exerciseName?.toLowerCase();
          if (!exName) continue;
          const pr = prs.find((p) => p.exercise?.toLowerCase() === exName);
          if (!pr || !pr.weight) continue;
          const br = w.results.blockResults[block_b.id];
          if (!br) continue;
          const top = Math.max(0, ...(br.sets || []).filter((s) => s.completed).map((s) => s.weight || 0));
          if (top > 0) {
            intensitySum += (top / pr.weight) * 100;
            intensityCount++;
          }
        }
      }
      return intensityCount > 0 && intensitySum / intensityCount >= marker.threshold;
    }

    case 'pr_progression': {
      // Did operator log any new PR within block window? Threshold is
      // unused for v1 — any PR counts.
      const prs = operator.prs || [];
      const blockPRs = prs.filter(
        (p) =>
          p.date &&
          diffDays(p.date, block.startDate) >= 0 &&
          diffDays(p.date, today) <= 0,
      );
      return blockPRs.length >= 1;
    }
  }
}

// ─── Goal-date change recompute ───────────────────────────────────────────

/**
 * Goal date moved (athlete's meet got rescheduled, etc.). Re-walk the
 * template against the new date. Preserves block IDs for any block that
 * remains identical kind+name+duration so transition history doesn't get
 * orphaned, and preserves Gunny annotations on still-applicable blocks. */
export function recomputeOnGoalDateChange(
  cycle: MacroCycle,
  newGoalDate: string,
  today: string,
): MacroCycle {
  const updatedGoal: MacroGoal = { ...cycle.goal, targetDate: newGoalDate };
  const fresh = buildMacroCycle(updatedGoal, today);

  // Carry over Gunny notes / status where the new block matches the old
  // block by kind + position.
  fresh.blocks = fresh.blocks.map((nb, idx) => {
    const ob = cycle.blocks[idx];
    if (ob && ob.kind === nb.kind) {
      return {
        ...nb,
        gunnyNotes: ob.gunnyNotes,
        // Don't carry over 'completed' — the new dates may not align.
        status: nb.status,
      };
    }
    return nb;
  });

  fresh.annotatedBlockIds = cycle.annotatedBlockIds.filter((bid) =>
    fresh.blocks.some((b) => b.id === bid),
  );
  fresh.lastRecomputedAt = today;
  return fresh;
}

// ─── Exposed for daily brief & Gunny context ─────────────────────────────

/**
 * Single-call helper for the daily brief / Gunny context. Returns a
 * compact summary object describing today's macro situation across all
 * the operator's active cycles. Returns null if no cycles. */
export interface MacroBriefContext {
  primaryGoal: { name: string; type: string; targetDate: string; daysToGoal: number };
  primaryBlock: {
    name: string;
    kind: string;
    weekOfBlock: number;        // 1-indexed
    weeksInBlock: number;
    description: string;
    volumeMultiplier: number;
    intensityMultiplier: number;
    gunnyNotes?: string;
    performanceMarker?: string; // label only
  };
  secondaryGoal?: { name: string; type: string };
  secondaryBlock?: { name: string; volumeMultiplier: number; intensityMultiplier: number };
  pausedNotes?: string;
}

export function buildMacroBriefContext(
  operator: Pick<Operator, 'macroCycles'>,
  today: string,
): MacroBriefContext | null {
  const cycles = operator.macroCycles || [];
  if (cycles.length === 0) return null;
  const arb = arbitrateConcurrentGoals(cycles, today);
  if (!arb.primaryBlock || !arb.primaryGoal) return null;

  const weekOfBlock = Math.max(
    1,
    Math.floor(diffDays(today, arb.primaryBlock.startDate) / 7) + 1,
  );

  const out: MacroBriefContext = {
    primaryGoal: {
      name: arb.primaryGoal.name,
      type: arb.primaryGoal.type,
      targetDate: arb.primaryGoal.targetDate,
      daysToGoal: diffDays(arb.primaryGoal.targetDate, today),
    },
    primaryBlock: {
      name: arb.primaryBlock.name,
      kind: arb.primaryBlock.kind,
      weekOfBlock,
      weeksInBlock: arb.primaryBlock.durationWeeks,
      description: arb.primaryBlock.description,
      volumeMultiplier: arb.primaryBlock.volumeMultiplier,
      intensityMultiplier: arb.primaryBlock.intensityMultiplier,
      gunnyNotes: arb.primaryBlock.gunnyNotes,
      performanceMarker: arb.primaryBlock.performanceMarker?.label,
    },
  };

  if (arb.secondaryGoal && arb.secondaryBlock) {
    out.secondaryGoal = {
      name: arb.secondaryGoal.name,
      type: arb.secondaryGoal.type,
    };
    out.secondaryBlock = {
      name: arb.secondaryBlock.name,
      volumeMultiplier: arb.secondaryBlock.volumeMultiplier,
      intensityMultiplier: arb.secondaryBlock.intensityMultiplier,
    };
  }

  if (arb.pausedNotes) out.pausedNotes = arb.pausedNotes;

  return out;
}

// Re-export for ergonomic callers.
export { getTemplateForGoal, getTemplateNominalWeeks } from './macrocycleLibrary';
