import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// PUT /api/operators/:id — update a single operator
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const updated = await prisma.operator.update({
      where: { id },
      data: {
        name: body.name,
        callsign: body.callsign,
        pin: body.pin,
        role: body.role,
        tier: body.tier,
        coupleWith: body.coupleWith ?? null,
        trainerId: body.trainerId ?? null,
        clientIds: body.clientIds ?? [],
        trainerNotes: body.trainerNotes ?? null,
        betaUser: body.betaUser ?? false,
        betaFeedback: body.betaFeedback ?? [],
        betaStartDate: body.betaStartDate ?? null,
        betaEndDate: body.betaEndDate ?? null,
        isVanguard: body.isVanguard ?? false,
        tierLocked: body.tierLocked ?? false,
        promoActive: body.promoActive ?? false,
        promoType: body.promoType ?? null,
        promoExpiry: body.promoExpiry ?? null,
        intake: body.intake ?? {},
        profile: body.profile ?? {},
        nutrition: body.nutrition ?? {},
        prs: body.prs ?? [],
        injuries: body.injuries ?? [],
        preferences: body.preferences ?? {},
        workouts: body.workouts ?? {},
        dayTags: body.dayTags ?? {},
      },
    });

    return NextResponse.json({ operator: updated });
  } catch (error) {
    console.error('Failed to update operator:', error);
    return NextResponse.json({ error: 'Failed to update operator' }, { status: 500 });
  }
}
