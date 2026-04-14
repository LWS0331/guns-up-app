import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';

// PATCH /api/operators/:id/profile
// Targeted update of profile / intake / nutrition / preferences / sitrep / dailyBrief.
// Skips the workouts field entirely to prevent races against /workouts PATCH.
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
    const data: Record<string, unknown> = {};
    // Whitelist of profile-side fields
    const allowed = [
      'name', 'callsign', 'intake', 'profile', 'nutrition', 'preferences',
      'sitrep', 'dailyBrief', 'trainerNotes',
    ] as const;
    for (const k of allowed) {
      if (body[k] !== undefined) data[k] = body[k];
    }
    // Admin-only fields
    if (isAdmin) {
      const adminAllowed = [
        'tier', 'role', 'coupleWith', 'trainerId', 'clientIds',
        'betaUser', 'betaFeedback', 'betaStartDate', 'betaEndDate',
        'isVanguard', 'tierLocked', 'promoActive', 'promoType', 'promoExpiry',
      ] as const;
      for (const k of adminAllowed) {
        if (body[k] !== undefined) data[k] = body[k];
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No profile fields supplied' }, { status: 400 });
    }

    const updated = await prisma.operator.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, operator: updated });
  } catch (error) {
    console.error('[api/operators/:id/profile PATCH] Failed:', error);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
