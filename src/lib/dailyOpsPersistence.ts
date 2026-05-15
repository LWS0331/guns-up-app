// Daily Ops — server-side persistence helper.
//
// Extracted from /api/daily-ops/route.ts so /api/gunny/route.ts can
// import the upsert without round-tripping through the route file
// (Next.js route imports trigger their own module-resolution quirks
// in TypeScript narrowing).

import { prisma } from '@/lib/db';
import { hasCommanderAccess } from '@/lib/tierGates';
import { applyJuniorGuardrailsToDailyOps } from '@/lib/dailyOpsGuardrails';
import {
  validateDailyOpsPayload,
  type DailyBlock,
  type BlockFeedback,
  type DailyOpsBasis,
  type DailyOpsPlanShape,
} from '@/lib/dailyOpsTypes';
import type { Prisma } from '@/generated/prisma/client';

interface UpsertArgs {
  operatorId: string;
  rawPayload: unknown;
  generatedBy?: 'gunny' | 'gunny_adapted';
}

interface UpsertOk {
  ok: true;
  plan: DailyOpsPlanShape;
  guardrail?: { removed: number; modified: number; reasons: string[] };
}
interface UpsertErr {
  ok: false;
  error: string;
}
export type UpsertResult = UpsertOk | UpsertErr;

/**
 * Resolve which tier should be checked for Commander access.
 * - Adult operators: their own tier
 * - Junior operators: any linked parent's tier (first Commander unlocks)
 */
async function isCommanderForOperator(operator: {
  id: string;
  isJunior: boolean;
  parentIds: string[];
  tier: string | null;
  role: string;
}): Promise<boolean> {
  if (!operator.isJunior) {
    return hasCommanderAccess({
      id: operator.id,
      tier: operator.tier ?? undefined,
      role: operator.role,
    });
  }
  if (operator.parentIds.length === 0) return false;
  const parents = await prisma.operator.findMany({
    where: { id: { in: operator.parentIds } },
    select: { id: true, tier: true, role: true },
  });
  return parents.some((p) =>
    hasCommanderAccess({ id: p.id, tier: p.tier ?? undefined, role: p.role }),
  );
}

export function planRowToShape(plan: {
  id: string;
  operatorId: string;
  date: string;
  generatedAt: Date;
  generatedBy: string;
  status: string;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectionNotes: string | null;
  basis: unknown;
  blocks: unknown;
  notes: string | null;
  feedback: unknown;
}): DailyOpsPlanShape {
  return {
    id: plan.id,
    operatorId: plan.operatorId,
    date: plan.date,
    generatedAt: plan.generatedAt.toISOString(),
    generatedBy: plan.generatedBy as DailyOpsPlanShape['generatedBy'],
    status: plan.status as DailyOpsPlanShape['status'],
    approvedBy: plan.approvedBy,
    approvedAt: plan.approvedAt?.toISOString() ?? null,
    rejectionNotes: plan.rejectionNotes,
    basis: (plan.basis ?? { date: plan.date }) as DailyOpsBasis,
    blocks: Array.isArray(plan.blocks) ? (plan.blocks as DailyBlock[]) : [],
    notes: plan.notes,
    feedback:
      plan.feedback &&
      typeof plan.feedback === 'object' &&
      !Array.isArray(plan.feedback)
        ? (plan.feedback as unknown as Record<string, BlockFeedback>)
        : {},
  };
}

export async function upsertDailyOpsPlan(args: UpsertArgs): Promise<UpsertResult> {
  const validated = validateDailyOpsPayload(args.rawPayload);
  if (!validated) return { ok: false, error: 'Invalid daily_ops_json shape' };

  const op = await prisma.operator.findUnique({
    where: { id: args.operatorId },
    select: {
      id: true,
      isJunior: true,
      juniorAge: true,
      parentIds: true,
      tier: true,
      role: true,
    },
  });
  if (!op) return { ok: false, error: 'Operator not found' };

  const allowed = await isCommanderForOperator({
    id: op.id,
    isJunior: op.isJunior,
    parentIds: op.parentIds ?? [],
    tier: op.tier,
    role: op.role,
  });
  if (!allowed) return { ok: false, error: 'Commander tier required for Daily Ops' };

  let blocks = validated.blocks;
  let guardrail: { removed: number; modified: number; reasons: string[] } | undefined;
  if (op.isJunior) {
    const age = op.juniorAge ?? 0;
    const result = applyJuniorGuardrailsToDailyOps(blocks, age);
    blocks = result.blocks;
    guardrail = {
      removed: result.removed,
      modified: result.modified,
      reasons: result.reasons,
    };
    if (guardrail.removed > 0 || guardrail.modified > 0) {
      // eslint-disable-next-line no-console
      console.warn('[daily-ops] junior guardrails applied for', args.operatorId, guardrail);
    }
  }

  const status = op.isJunior ? 'pending_parent_approval' : 'active';

  const upserted = await prisma.dailyOpsPlan.upsert({
    where: { operatorId_date: { operatorId: args.operatorId, date: validated.date } },
    create: {
      operatorId: args.operatorId,
      date: validated.date,
      generatedBy: args.generatedBy ?? 'gunny',
      status,
      basis: validated.basis as unknown as Prisma.InputJsonValue,
      blocks: blocks as unknown as Prisma.InputJsonValue,
      notes: validated.notes,
      feedback: {} as Prisma.InputJsonValue,
    },
    update: {
      generatedAt: new Date(),
      generatedBy: args.generatedBy ?? 'gunny',
      status,
      // Plan regeneration clears the approval state — parent re-reviews.
      approvedBy: null,
      approvedAt: null,
      rejectionNotes: null,
      basis: validated.basis as unknown as Prisma.InputJsonValue,
      blocks: blocks as unknown as Prisma.InputJsonValue,
      notes: validated.notes,
    },
  });

  return { ok: true, plan: planRowToShape(upserted), guardrail };
}

// ---------------------------------------------------------------------------
// Block override — Phase 2B. Surgical edit of one block's startTime /
// endTime on an existing plan. Stamps a BlockFeedback with source='chat'
// so the rhythm aggregator picks up the signal next compute. Used by:
//   1. /api/daily-ops POST { action: 'block_override' }
//   2. /api/gunny <daily_ops_block_override> channel
// Both share this path so the rhythm-learning behavior is consistent.
// ---------------------------------------------------------------------------

export interface BlockOverrideArgs {
  operatorId: string;
  /** YYYY-MM-DD — defaults to today's plan if omitted. */
  date?: string;
  blockId: string;
  newStartTime?: string;
  newEndTime?: string;
  /** If omitted, inferred from the time direction (later = too_early). */
  perceivedFit?: 'too_early' | 'right' | 'too_late' | 'na';
  /** 'tap' | 'chat' | 'wearable_inferred'. Defaults to 'chat'. */
  feedbackSource?: 'tap' | 'chat' | 'wearable_inferred';
}

const HHMM_RE = /^\d{2}:\d{2}$/;

function hhmmToMinUtil(s: string): number {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

export async function applyBlockOverride(args: BlockOverrideArgs): Promise<UpsertResult> {
  if (args.newStartTime && !HHMM_RE.test(args.newStartTime)) {
    return { ok: false, error: 'newStartTime must be HH:MM' };
  }
  if (args.newEndTime && !HHMM_RE.test(args.newEndTime)) {
    return { ok: false, error: 'newEndTime must be HH:MM' };
  }
  if (!args.newStartTime && !args.newEndTime) {
    return { ok: false, error: 'newStartTime or newEndTime required' };
  }

  // Resolve target plan — date if provided, otherwise today's plan
  // (the most recent active row for this operator with status in
  // {active, approved}). Pending-approval junior plans can also be
  // overridden — the parent re-reviews on next regen anyway.
  let plan;
  if (args.date) {
    plan = await prisma.dailyOpsPlan.findUnique({
      where: { operatorId_date: { operatorId: args.operatorId, date: args.date } },
    });
  } else {
    plan = await prisma.dailyOpsPlan.findFirst({
      where: { operatorId: args.operatorId },
      orderBy: { date: 'desc' },
    });
  }
  if (!plan) return { ok: false, error: 'No plan found for override' };

  const blocks: DailyBlock[] = Array.isArray(plan.blocks)
    ? (plan.blocks as unknown as DailyBlock[])
    : [];
  const idx = blocks.findIndex((b) => b.id === args.blockId);
  if (idx === -1) {
    return { ok: false, error: `Block ${args.blockId} not in plan ${plan.id}` };
  }

  const oldStart = blocks[idx].startTime;
  const updatedBlocks: DailyBlock[] = blocks.map((b, i) =>
    i === idx
      ? {
          ...b,
          startTime: args.newStartTime ?? b.startTime,
          endTime: args.newEndTime ?? b.endTime,
          source: 'user_override',
        }
      : b,
  );

  // Infer perceivedFit from time direction if not supplied. Pushed
  // later → operator felt the block was too_early. Pulled earlier →
  // too_late.
  let perceivedFit = args.perceivedFit;
  if (!perceivedFit && args.newStartTime) {
    const oldMin = hhmmToMinUtil(oldStart);
    const newMin = hhmmToMinUtil(args.newStartTime);
    if (newMin > oldMin) perceivedFit = 'too_early';
    else if (newMin < oldMin) perceivedFit = 'too_late';
    else perceivedFit = 'right';
  }

  const feedback: BlockFeedback = {
    followed: 'partial',
    perceivedFit,
    notes: args.newStartTime
      ? `override → ${args.newStartTime}`
      : `end override → ${args.newEndTime}`,
    source: args.feedbackSource ?? 'chat',
    at: new Date().toISOString(),
  };

  const existing: Record<string, BlockFeedback> =
    plan.feedback &&
    typeof plan.feedback === 'object' &&
    !Array.isArray(plan.feedback)
      ? (plan.feedback as unknown as Record<string, BlockFeedback>)
      : {};
  const nextFeedback = { ...existing, [args.blockId]: feedback };

  const updated = await prisma.dailyOpsPlan.update({
    where: { id: plan.id },
    data: {
      blocks: updatedBlocks as unknown as Prisma.InputJsonValue,
      feedback: nextFeedback as unknown as Prisma.InputJsonValue,
    },
  });

  return { ok: true, plan: planRowToShape(updated) };
}
