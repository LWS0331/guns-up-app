import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTrainerAuth } from '@/lib/requireTrainerAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import { mergeDailyOps, readDailyOps, type DailyOpsPatch } from '@/lib/dailyOpsSop';

// Daily Ops SOP routes — the operator/coach-authored standing daily
// routine on operator.dailyOps. DISTINCT from /api/daily-ops (the
// per-day generated schedule planner).
//
//   GET   /api/operators/:id/daily-ops  → { dailyOps: DailyOpsSOP | null }
//   PATCH /api/operators/:id/daily-ops  → deep-merge a patch; bumps
//                                         version + updatedAt server-side.
//
// Auth mirrors the profile subroute: self / admin / trainer-of-target
// may read AND write; a parent of a junior may read only (parents own
// consent/safety, not the kid's training SOP).

type Relationship = {
  isSelf: boolean;
  isAdmin: boolean;
  isTrainerOfTarget: boolean;
  isParentOfTarget: boolean;
};

async function resolveRelationship(actorId: string, targetId: string): Promise<Relationship> {
  const isSelf = actorId === targetId;
  const isAdmin = OPS_CENTER_ACCESS.includes(actorId);
  let isTrainerOfTarget = false;
  let isParentOfTarget = false;
  if (!isSelf && !isAdmin) {
    const target = await prisma.operator.findUnique({
      where: { id: targetId },
      select: { trainerId: true, isJunior: true, parentIds: true },
    });
    isTrainerOfTarget = !!target && target.trainerId === actorId;
    isParentOfTarget = !!target?.isJunior && (target?.parentIds || []).includes(actorId);
  }
  return { isSelf, isAdmin, isTrainerOfTarget, isParentOfTarget };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireTrainerAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const rel = await resolveRelationship(auth.operatorId, id);
    if (!rel.isSelf && !rel.isAdmin && !rel.isTrainerOfTarget && !rel.isParentOfTarget) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const row = await prisma.operator.findUnique({
      where: { id },
      select: { dailyOps: true },
    });
    if (!row) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }

    return NextResponse.json({ dailyOps: readDailyOps(row.dailyOps) });
  } catch (error) {
    console.error('[api/operators/:id/daily-ops GET] Failed:', error);
    return NextResponse.json({ error: 'Failed to read daily ops' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireTrainerAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const rel = await resolveRelationship(auth.operatorId, id);
    // Parents are read-only here; writes require self / admin / trainer.
    if (!rel.isSelf && !rel.isAdmin && !rel.isTrainerOfTarget) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    // Whitelist the patchable fields; ignore client-supplied version /
    // updatedAt (server owns those). authoredBy is honored but
    // constrained to the two known values.
    const src = body as Record<string, unknown>;
    const patch: DailyOpsPatch = {};
    if (src.markdown !== undefined) {
      if (typeof src.markdown !== 'string') {
        return NextResponse.json({ error: 'markdown must be a string' }, { status: 400 });
      }
      patch.markdown = src.markdown;
    }
    if (src.anchors !== undefined) {
      if (!Array.isArray(src.anchors)) {
        return NextResponse.json({ error: 'anchors must be an array' }, { status: 400 });
      }
      patch.anchors = src.anchors as DailyOpsPatch['anchors'];
    }
    if (src.supplementSchedule !== undefined) {
      if (!Array.isArray(src.supplementSchedule)) {
        return NextResponse.json({ error: 'supplementSchedule must be an array' }, { status: 400 });
      }
      patch.supplementSchedule = src.supplementSchedule as DailyOpsPatch['supplementSchedule'];
    }
    if (src.sleepProtocol !== undefined) {
      if (!Array.isArray(src.sleepProtocol)) {
        return NextResponse.json({ error: 'sleepProtocol must be an array' }, { status: 400 });
      }
      patch.sleepProtocol = src.sleepProtocol as DailyOpsPatch['sleepProtocol'];
    }
    if (src.trainingVariants !== undefined) {
      patch.trainingVariants = src.trainingVariants as DailyOpsPatch['trainingVariants'];
    }
    if (src.phase !== undefined) {
      patch.phase = src.phase as DailyOpsPatch['phase'];
    }

    // authoredBy: explicit on the body, else "operator" for app-side
    // writes. The MCP set_daily_ops tools pass "gunny".
    const authoredBy =
      src.authoredBy === 'gunny' || src.authoredBy === 'operator'
        ? (src.authoredBy as string)
        : 'operator';

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'No daily ops fields supplied' },
        { status: 400 },
      );
    }

    const existing = await prisma.operator.findUnique({
      where: { id },
      select: { dailyOps: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }

    const merged = mergeDailyOps(existing.dailyOps, patch, { authoredBy });

    const updated = await prisma.operator.update({
      where: { id },
      data: { dailyOps: merged as unknown as object },
      select: { dailyOps: true },
    });

    return NextResponse.json({ ok: true, dailyOps: updated.dailyOps });
  } catch (error) {
    console.error('[api/operators/:id/daily-ops PATCH] Failed:', error);
    return NextResponse.json({ error: 'Failed to update daily ops' }, { status: 500 });
  }
}
