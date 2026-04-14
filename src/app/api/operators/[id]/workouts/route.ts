import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';

// PATCH /api/operators/:id/workouts
// Targeted update of ONLY the workouts field (plus optional prs/injuries).
// Prevents multi-field races when two tabs save concurrently.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireAuth(req);
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

    const body = await req.json();
    // Only accept workouts-related fields; all others are ignored.
    const data: Record<string, unknown> = {};
    if (body.workouts !== undefined) data.workouts = body.workouts;
    if (body.prs !== undefined) data.prs = body.prs;
    if (body.dayTags !== undefined) data.dayTags = body.dayTags;
    if (body.injuries !== undefined) data.injuries = body.injuries;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No workout fields supplied' }, { status: 400 });
    }

    const updated = await prisma.operator.update({
      where: { id },
      data,
      select: {
        id: true,
        workouts: true,
        prs: true,
        dayTags: true,
        injuries: true,
      },
    });

    return NextResponse.json({ ok: true, updated });
  } catch (error) {
    console.error('[api/operators/:id/workouts PATCH] Failed:', error);
    return NextResponse.json({ error: 'Failed to update workouts' }, { status: 500 });
  }
}
