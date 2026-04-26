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
    let isParentOfTarget = false;
    if (!isSelf && !isAdmin) {
      // Single query pulls trainerId + parentIds + isJunior so we can
      // check both relationships in one round trip.
      const target = await prisma.operator.findUnique({
        where: { id },
        select: { trainerId: true, isJunior: true, parentIds: true },
      });
      isTrainerOfTarget = !!target && target.trainerId === auth.operatorId;
      isParentOfTarget = !!target?.isJunior && (target?.parentIds || []).includes(auth.operatorId);
    }
    if (!isSelf && !isAdmin && !isTrainerOfTarget && !isParentOfTarget) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    // PARENT path: parents of a junior can ONLY write juniorConsent
    // (emergency contact, pediatrician clearance) and juniorSafety
    // (mark events resolved). They cannot edit the kid's profile,
    // workouts, intake, or anything else. This is the read/write
    // asymmetry the PARENT HUB depends on.
    if (isParentOfTarget && !isAdmin && !isSelf && !isTrainerOfTarget) {
      const parentAllowed = ['juniorConsent', 'juniorSafety'] as const;
      for (const k of parentAllowed) {
        if (body[k] !== undefined) data[k] = body[k];
      }
    } else {
      // SELF / TRAINER / ADMIN path: existing whitelist plus the
      // junior-owned fields (sportProfile, juniorConsent, juniorSafety,
      // juniorAge). Without these, JuniorIntakeForm.onComplete loses
      // the kid's sportProfile + consent on save (intake.completed
      // persists but the rest is dropped).
      const allowed = [
        'name', 'callsign', 'intake', 'profile', 'nutrition', 'preferences',
        'sitrep', 'dailyBrief', 'trainerNotes',
        'sportProfile', 'juniorConsent', 'juniorSafety', 'juniorAge',
      ] as const;
      for (const k of allowed) {
        if (body[k] !== undefined) data[k] = body[k];
      }
      // Admin-only fields (privilege/billing + identity-level junior toggles)
      if (isAdmin) {
        const adminAllowed = [
          'tier', 'role', 'coupleWith', 'trainerId', 'clientIds',
          'betaUser', 'betaFeedback', 'betaStartDate', 'betaEndDate',
          'isVanguard', 'tierLocked', 'promoActive', 'promoType', 'promoExpiry',
          'isJunior', 'parentIds',
        ] as const;
        for (const k of adminAllowed) {
          if (body[k] !== undefined) data[k] = body[k];
        }
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
