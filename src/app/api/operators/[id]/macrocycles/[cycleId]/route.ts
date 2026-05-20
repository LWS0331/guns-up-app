import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTrainerAuth } from '@/lib/requireTrainerAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import type { MacroCycle, MacroGoal } from '@/lib/types';
import { recomputeOnGoalDateChange } from '@/lib/macrocycle';

// PATCH /api/operators/:id/macrocycles/:cycleId — update a macrocycle's
// goal. Supports renaming, retargeting the date (triggers
// recomputeOnGoalDateChange — blocks regenerate), changing priority,
// updating targetMetrics, or setting status (active/completed/paused/
// cancelled).
//
// DELETE /api/operators/:id/macrocycles/:cycleId — remove a macrocycle.
//
// Auth: self / admin / trainer-of-target.

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

async function authorize(
  req: NextRequest,
  operatorId: string
): Promise<NextResponse | { operatorId: string }> {
  const auth = requireTrainerAuth(req);
  if (auth instanceof NextResponse) return auth;

  const isSelf = auth.operatorId === operatorId;
  const isAdmin = OPS_CENTER_ACCESS.includes(auth.operatorId);
  let isTrainerOfTarget = false;
  if (!isSelf && !isAdmin) {
    const target = await prisma.operator.findUnique({
      where: { id: operatorId },
      select: { trainerId: true },
    });
    isTrainerOfTarget = !!target && target.trainerId === auth.operatorId;
  }
  if (!isSelf && !isAdmin && !isTrainerOfTarget) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  return { operatorId: auth.operatorId };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cycleId: string }> }
) {
  try {
    const { id, cycleId } = await params;
    const authResult = await authorize(req, id);
    if (authResult instanceof NextResponse) return authResult;

    const body = (await req.json()) as {
      name?: string;
      targetDate?: string;
      priority?: 1 | 2;
      targetMetrics?: Record<string, number>;
      status?: MacroGoal['status'];
      today?: string;
    };

    const op = await prisma.operator.findUnique({
      where: { id },
      select: { macroCycles: true },
    });
    if (!op) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }
    const cycles = Array.isArray(op.macroCycles)
      ? ([...op.macroCycles] as unknown as MacroCycle[])
      : [];
    const idx = cycles.findIndex((c) => c.id === cycleId);
    if (idx < 0) {
      return NextResponse.json({ error: `Cycle ${cycleId} not found` }, { status: 404 });
    }

    const current = cycles[idx];
    let next: MacroCycle = current;

    // If targetDate changed, the block sequence has to regenerate so
    // periodization aligns with the new horizon.
    if (body.targetDate && body.targetDate !== current.goal.targetDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.targetDate)) {
        return NextResponse.json(
          { error: 'targetDate must be YYYY-MM-DD' },
          { status: 400 }
        );
      }
      const today = body.today && /^\d{4}-\d{2}-\d{2}$/.test(body.today)
        ? body.today
        : todayKey();
      if (body.targetDate <= today) {
        return NextResponse.json(
          { error: `targetDate (${body.targetDate}) must be after today (${today})` },
          { status: 400 }
        );
      }
      next = recomputeOnGoalDateChange(current, body.targetDate, today);
    }

    // Apply non-date goal patches on top of (possibly recomputed) cycle.
    const goalPatch: Partial<MacroGoal> = {};
    if (body.name !== undefined) goalPatch.name = String(body.name).trim();
    if (body.priority !== undefined) {
      goalPatch.priority = body.priority === 2 ? 2 : 1;
    }
    if (body.targetMetrics !== undefined) {
      goalPatch.targetMetrics = body.targetMetrics;
    }
    if (body.status !== undefined) {
      const validStatuses: Array<MacroGoal['status']> = [
        'active', 'completed', 'paused', 'cancelled',
      ];
      if (!validStatuses.includes(body.status)) {
        return NextResponse.json(
          { error: `Invalid status — must be one of: ${validStatuses.join(', ')}` },
          { status: 400 }
        );
      }
      goalPatch.status = body.status;
    }
    if (Object.keys(goalPatch).length > 0) {
      next = { ...next, goal: { ...next.goal, ...goalPatch } };
    }

    cycles[idx] = next;
    await prisma.operator.update({
      where: { id },
      data: { macroCycles: cycles as object },
    });

    return NextResponse.json({ ok: true, cycle: next });
  } catch (err) {
    console.error('[api/operators/:id/macrocycles/:cycleId PATCH] failed:', err);
    return NextResponse.json({ error: 'Failed to update macrocycle' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cycleId: string }> }
) {
  try {
    const { id, cycleId } = await params;
    const authResult = await authorize(req, id);
    if (authResult instanceof NextResponse) return authResult;

    const op = await prisma.operator.findUnique({
      where: { id },
      select: { macroCycles: true },
    });
    if (!op) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }
    const cycles = Array.isArray(op.macroCycles)
      ? (op.macroCycles as unknown as MacroCycle[])
      : [];
    const filtered = cycles.filter((c) => c.id !== cycleId);
    if (filtered.length === cycles.length) {
      return NextResponse.json({ error: `Cycle ${cycleId} not found` }, { status: 404 });
    }
    await prisma.operator.update({
      where: { id },
      data: { macroCycles: filtered as object },
    });

    return NextResponse.json({ ok: true, removedId: cycleId });
  } catch (err) {
    console.error('[api/operators/:id/macrocycles/:cycleId DELETE] failed:', err);
    return NextResponse.json({ error: 'Failed to delete macrocycle' }, { status: 500 });
  }
}
