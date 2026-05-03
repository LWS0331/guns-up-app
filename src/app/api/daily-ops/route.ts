// /api/daily-ops — Daily Ops planner CRUD.
//
// MVP (May 2026):
//   GET    /api/daily-ops?date=YYYY-MM-DD    — fetch today's plan (or null)
//                                              also returns ?pendingApprovals=true
//                                              for parent operators to list their
//                                              juniors' pending plans
//   POST   /api/daily-ops/feedback           — { planId, blockId?, followed,
//                                                perceivedFit?, notes? } — stamp
//                                                block- or day-level feedback
//   POST   /api/daily-ops/approve            — { planId, approved: bool, notes? }
//                                                — parent approves/rejects a
//                                                junior's pending plan
//
// Plan creation does NOT happen here — Gunny emits the plan via the
// `<daily_ops_json>` channel in /api/gunny, which calls
// upsertDailyOpsPlan() below. This keeps the channel-based persistence
// pattern aligned with how `<workout_json>` and `<pr_json>` work.
//
// Tier-gate: Daily Ops is a Commander (opus / white_glove) feature.
// Adults get 402 if they're below Commander; juniors are gated by
// their parent's tier (the parent must be Commander to enable Daily
// Ops generation for the junior).

import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import { planRowToShape } from '@/lib/dailyOpsPersistence';
import type { BlockFeedback } from '@/lib/dailyOpsTypes';

// Re-export so callers (Gunny route, tests) can import from the API route too.
export { upsertDailyOpsPlan } from '@/lib/dailyOpsPersistence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AuthorizationResult {
  operator: {
    id: string;
    isJunior: boolean;
    juniorAge: number | null;
    parentIds: string[];
    tier: string | null;
    role: string;
  };
  /** The viewer (request-issuing user) — may be operator themselves, a parent, an admin, or a trainer. */
  viewerId: string;
  isAdmin: boolean;
  isParent: boolean;
  isTrainer: boolean;
  isSelf: boolean;
}

async function authorizeAccess(
  req: NextRequest,
  operatorId: string,
): Promise<AuthorizationResult | NextResponse> {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const op = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: {
      id: true,
      isJunior: true,
      juniorAge: true,
      parentIds: true,
      tier: true,
      role: true,
      trainerId: true,
    },
  });
  if (!op) return NextResponse.json({ error: 'Operator not found' }, { status: 404 });

  const isSelf = auth.operatorId === operatorId;
  const isAdmin = OPS_CENTER_ACCESS.includes(auth.operatorId);
  const isParent = (op.parentIds ?? []).includes(auth.operatorId);
  const isTrainer = op.trainerId === auth.operatorId;

  if (!isSelf && !isAdmin && !isParent && !isTrainer) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return {
    operator: {
      id: op.id,
      isJunior: op.isJunior,
      juniorAge: op.juniorAge,
      parentIds: op.parentIds ?? [],
      tier: op.tier,
      role: op.role,
    },
    viewerId: auth.operatorId,
    isAdmin,
    isParent,
    isTrainer,
    isSelf,
  };
}

// ---------------------------------------------------------------------------
// GET — fetch today's plan, or list pending approvals for a parent
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const pendingApprovals = url.searchParams.get('pendingApprovals') === 'true';

  if (pendingApprovals) {
    // Parent listing: every junior whose parentIds includes the viewer
    // and who has at least one plan in pending_parent_approval state.
    const juniors = await prisma.operator.findMany({
      where: {
        isJunior: true,
        parentIds: { has: auth.operatorId },
      },
      select: { id: true, callsign: true, juniorAge: true, name: true },
    });
    if (juniors.length === 0) return NextResponse.json({ ok: true, pending: [] });

    const pending = await prisma.dailyOpsPlan.findMany({
      where: {
        operatorId: { in: juniors.map((j) => j.id) },
        status: 'pending_parent_approval',
      },
      orderBy: { generatedAt: 'desc' },
      take: 50,
    });

    const juniorById = new Map(juniors.map((j) => [j.id, j]));
    return NextResponse.json({
      ok: true,
      pending: pending.map((p) => ({
        plan: planRowToShape(p),
        junior: juniorById.get(p.operatorId) ?? null,
      })),
    });
  }

  const date = url.searchParams.get('date');
  const operatorId = url.searchParams.get('operatorId') || auth.operatorId;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date=YYYY-MM-DD required' }, { status: 400 });
  }

  const accessResult = await authorizeAccess(req, operatorId);
  if (accessResult instanceof NextResponse) return accessResult;

  const plan = await prisma.dailyOpsPlan.findUnique({
    where: { operatorId_date: { operatorId, date } },
  });

  return NextResponse.json({
    ok: true,
    plan: plan ? planRowToShape(plan) : null,
  });
}

// ---------------------------------------------------------------------------
// POST — feedback OR approval (action discriminator in body)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = (await req.json().catch(() => null)) as
    | { action: 'feedback'; planId: string; blockId?: string; followed: 'yes' | 'partial' | 'no'; perceivedFit?: 'too_early' | 'right' | 'too_late' | 'na'; notes?: string }
    | { action: 'approve'; planId: string; approved: boolean; notes?: string }
    | null;

  if (!body || typeof body !== 'object' || !('action' in body)) {
    return NextResponse.json({ error: 'action required' }, { status: 400 });
  }

  const plan = await prisma.dailyOpsPlan.findUnique({ where: { id: body.planId } });
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

  const accessResult = await authorizeAccess(req, plan.operatorId);
  if (accessResult instanceof NextResponse) return accessResult;
  const access = accessResult;

  if (body.action === 'feedback') {
    if (body.followed !== 'yes' && body.followed !== 'partial' && body.followed !== 'no') {
      return NextResponse.json({ error: 'invalid followed value' }, { status: 400 });
    }
    const feedback: BlockFeedback = {
      followed: body.followed,
      perceivedFit: body.perceivedFit,
      notes: body.notes?.slice(0, 500),
      source: 'tap',
      at: new Date().toISOString(),
    };
    const existing: Record<string, BlockFeedback> =
      plan.feedback &&
      typeof plan.feedback === 'object' &&
      !Array.isArray(plan.feedback)
        ? (plan.feedback as unknown as Record<string, BlockFeedback>)
        : {};
    const next = { ...existing, [body.blockId ?? '__day__']: feedback };
    const updated = await prisma.dailyOpsPlan.update({
      where: { id: plan.id },
      data: { feedback: next as unknown as Prisma.InputJsonValue },
    });
    return NextResponse.json({ ok: true, plan: planRowToShape(updated) });
  }

  if (body.action === 'approve') {
    if (!access.isParent && !access.isAdmin) {
      return NextResponse.json(
        { error: 'Only a linked parent (or admin) can approve a junior plan' },
        { status: 403 },
      );
    }
    if (!access.operator.isJunior) {
      return NextResponse.json(
        { error: 'Approval flow is junior-only — adult plans land active' },
        { status: 400 },
      );
    }
    if (plan.status !== 'pending_parent_approval' && plan.status !== 'rejected') {
      return NextResponse.json(
        { error: `Plan is in status=${plan.status}; only pending_parent_approval / rejected can be re-decided` },
        { status: 400 },
      );
    }
    const updated = await prisma.dailyOpsPlan.update({
      where: { id: plan.id },
      data: {
        status: body.approved ? 'approved' : 'rejected',
        approvedBy: auth.operatorId,
        approvedAt: new Date(),
        rejectionNotes: body.approved ? null : body.notes?.slice(0, 500) ?? null,
      },
    });
    return NextResponse.json({ ok: true, plan: planRowToShape(updated) });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
