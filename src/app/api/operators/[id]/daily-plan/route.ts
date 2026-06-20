import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTrainerAuth } from '@/lib/requireTrainerAuth';
import { OPS_CENTER_ACCESS, isHeadTrainer } from '@/lib/types';
import { applyOverride, releaseOverride, readPlanOverride } from '@/lib/planOverride';

// Head-trainer daily-plan override routes.
//
//   GET   /api/operators/:id/daily-plan → { sitrep, dailyBrief, planOverride }
//   PATCH /api/operators/:id/daily-plan → write sitrep/dailyBrief + take over
//                                         (or release) the plan.
//
// The plan itself lives in the existing sitrep/dailyBrief columns (so the
// app renders it unchanged); this route also flips operator.planOverride
// so the generate-on-read refresh stops regenerating underneath the head
// trainer. DISTINCT from /daily-ops (the standing SOP).
//
// Authz: a head trainer (HEAD_TRAINER_ACCESS) or admin (OPS_CENTER_ACCESS)
// may override ANY operator. Read is broader: self / admin / head trainer /
// trainer-of-target / parent-of-junior.

type Relationship = {
  isSelf: boolean;
  isAdmin: boolean;
  isHead: boolean;
  isTrainerOfTarget: boolean;
  isParentOfTarget: boolean;
};

async function resolveRelationship(actorId: string, targetId: string): Promise<Relationship> {
  const isSelf = actorId === targetId;
  const isAdmin = OPS_CENTER_ACCESS.includes(actorId);
  const isHead = isHeadTrainer(actorId);
  let isTrainerOfTarget = false;
  let isParentOfTarget = false;
  // Head trainers and admins reach any operator, so skip the relationship
  // lookup for them.
  if (!isSelf && !isAdmin && !isHead) {
    const target = await prisma.operator.findUnique({
      where: { id: targetId },
      select: { trainerId: true, isJunior: true, parentIds: true },
    });
    isTrainerOfTarget = !!target && target.trainerId === actorId;
    isParentOfTarget = !!target?.isJunior && (target?.parentIds || []).includes(actorId);
  }
  return { isSelf, isAdmin, isHead, isTrainerOfTarget, isParentOfTarget };
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
    if (!rel.isSelf && !rel.isAdmin && !rel.isHead && !rel.isTrainerOfTarget && !rel.isParentOfTarget) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const row = await prisma.operator.findUnique({
      where: { id },
      select: { sitrep: true, dailyBrief: true, planOverride: true },
    });
    if (!row) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }

    return NextResponse.json({
      sitrep: row.sitrep,
      dailyBrief: row.dailyBrief,
      planOverride: readPlanOverride(row.planOverride),
    });
  } catch (error) {
    console.error('[api/operators/:id/daily-plan GET] Failed:', error);
    return NextResponse.json({ error: 'Failed to read daily plan' }, { status: 500 });
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
    // Overriding a plan is a head-trainer (or admin) power — not granted to
    // a regular trainer-of-target or the operator themselves.
    if (!rel.isHead && !rel.isAdmin) {
      return NextResponse.json({ error: 'Forbidden: head-trainer access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const src = body as Record<string, unknown>;

    const existing = await prisma.operator.findUnique({
      where: { id },
      select: { planOverride: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
    }

    // Validate the plan payloads (JSON objects) before they hit Prisma.
    const isObj = (v: unknown) => !!v && typeof v === 'object' && !Array.isArray(v);
    if (src.sitrep !== undefined && !isObj(src.sitrep)) {
      return NextResponse.json({ error: 'sitrep must be an object' }, { status: 400 });
    }
    if (src.dailyBrief !== undefined && !isObj(src.dailyBrief)) {
      return NextResponse.json({ error: 'dailyBrief must be an object' }, { status: 400 });
    }

    const data: Record<string, unknown> = {};
    if (src.sitrep !== undefined) data.sitrep = src.sitrep;
    if (src.dailyBrief !== undefined) data.dailyBrief = src.dailyBrief;

    if (src.release === true) {
      // Release the takeover — auto-generation resumes. Plan fields may
      // still be written alongside (e.g. seed a fresh plan, then release).
      data.planOverride = releaseOverride(existing.planOverride, { lockedBy: auth.operatorId }) as unknown as object;
    } else {
      // Take over (or refresh an active takeover). Requires at least one
      // plan field OR a NON-EMPTY note so an empty PATCH (incl. note:'')
      // can't silently lock an operator with no content.
      const trimmedNote = typeof src.note === 'string' ? src.note.trim() : '';
      if (data.sitrep === undefined && data.dailyBrief === undefined && trimmedNote === '') {
        return NextResponse.json(
          { error: 'Provide sitrep and/or dailyBrief (or a non-empty note), or pass release:true' },
          { status: 400 },
        );
      }
      data.planOverride = applyOverride(existing.planOverride, {
        lockedBy: auth.operatorId,
        note: typeof src.note === 'string' ? src.note : undefined,
      }) as unknown as object;
    }

    const updated = await prisma.operator.update({
      where: { id },
      data,
      select: { sitrep: true, dailyBrief: true, planOverride: true },
    });

    return NextResponse.json({
      ok: true,
      sitrep: updated.sitrep,
      dailyBrief: updated.dailyBrief,
      planOverride: readPlanOverride(updated.planOverride),
    });
  } catch (error) {
    console.error('[api/operators/:id/daily-plan PATCH] Failed:', error);
    return NextResponse.json({ error: 'Failed to update daily plan' }, { status: 500 });
  }
}
