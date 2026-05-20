import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTrainerAuth } from '@/lib/requireTrainerAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import type { MacroCycle, MacroGoal, MacroGoalType } from '@/lib/types';
import { buildMacroCycle } from '@/lib/macrocycle';

// POST /api/operators/:id/macrocycles
//
// Create a new macrocycle for an operator. Calls buildMacroCycle to
// generate the block sequence from a goal-type template; client only
// has to supply the goal metadata (type, name, targetDate, priority).
//
// Auth: self / admin / trainer-of-target. Trainer-of-target lets coaches
// build periodization plans for their clients via Claude.ai (Phase 3d
// MCP rollout) — same authorization model used by the rest of the
// operator-scoped routes.

const VALID_GOAL_TYPES: MacroGoalType[] = [
  'powerlifting_meet',
  'hypertrophy_phase',
  'season_prep',
  'fat_loss',
  'olympic_meet',
  'tactical_assessment',
  'crossfit_comp',
  'pregnancy_postpartum',
  'return_to_sport',
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireTrainerAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;

    const isSelf = auth.operatorId === id;
    const isAdmin = OPS_CENTER_ACCESS.includes(auth.operatorId);
    let isTrainerOfTarget = false;
    if (!isSelf && !isAdmin) {
      const target = await prisma.operator.findUnique({
        where: { id },
        select: { trainerId: true },
      });
      isTrainerOfTarget = !!target && target.trainerId === auth.operatorId;
    }
    if (!isSelf && !isAdmin && !isTrainerOfTarget) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = (await req.json()) as {
      type?: MacroGoalType;
      name?: string;
      targetDate?: string;
      priority?: 1 | 2;
      targetMetrics?: Record<string, number>;
      today?: string;
    };

    if (!body.type || !VALID_GOAL_TYPES.includes(body.type)) {
      return NextResponse.json(
        { error: `Invalid type — must be one of: ${VALID_GOAL_TYPES.join(', ')}` },
        { status: 400 }
      );
    }
    if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
      return NextResponse.json({ error: 'name required (non-empty string)' }, { status: 400 });
    }
    if (!body.targetDate || !/^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)) {
      return NextResponse.json({ error: 'targetDate required (YYYY-MM-DD)' }, { status: 400 });
    }
    const priority: 1 | 2 = body.priority === 2 ? 2 : 1;

    const today = body.today && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
      ? body.today
      : todayKey();
    if (body.targetDate <= today) {
      return NextResponse.json(
        { error: `targetDate (${body.targetDate}) must be after today (${today})` },
        { status: 400 }
      );
    }

    const goal: MacroGoal = {
      id: `goal-mcp-${Date.now()}`,
      type: body.type,
      name: body.name.trim(),
      targetDate: body.targetDate,
      priority,
      targetMetrics: body.targetMetrics,
      status: 'active',
      createdAt: new Date().toISOString(),
    };

    const cycle = buildMacroCycle(goal, today);

    // Append to operator.macroCycles. Honor the priority-arbitration rule
    // (max 2 active goals); if a 3rd is being added, the engine handles
    // the arbitration on read — we don't auto-pause anyone here.
    const op = await prisma.operator.findUnique({
      where: { id },
      select: { macroCycles: true },
    });
    if (!op) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }
    const existing = Array.isArray(op.macroCycles)
      ? (op.macroCycles as unknown as MacroCycle[])
      : [];
    const next = [...existing, cycle];
    await prisma.operator.update({
      where: { id },
      data: { macroCycles: next as object },
    });

    return NextResponse.json({ ok: true, cycle });
  } catch (err) {
    console.error('[api/operators/:id/macrocycles POST] failed:', err);
    return NextResponse.json({ error: 'Failed to create macrocycle' }, { status: 500 });
  }
}
