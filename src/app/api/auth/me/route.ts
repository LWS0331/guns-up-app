import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAuthOperator } from '@/lib/authMiddleware';
import { isOperatorAllowed, NOT_ALLOWED_RESPONSE } from '@/lib/allowlist';

export async function GET(request: NextRequest) {
  try {
    const authData = getAuthOperator(request);

    if (!authData) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let operator = await prisma.operator.findUnique({
      where: { id: authData.operatorId },
    });

    if (!operator) {
      return NextResponse.json(
        { error: 'Operator not found' },
        { status: 404 }
      );
    }

    // Allowlist gate. If an operator is de-activated (email cleared)
    // after their JWT was issued, the next /me call kicks them out
    // and the client clears the stored token (page.tsx:loadFromDB).
    if (!isOperatorAllowed(operator)) {
      return NextResponse.json(NOT_ALLOWED_RESPONSE, { status: 403 });
    }

    // Closed-beta auto-assign: clients without a trainerId get
    // routed to the default trainer (op-ruben). Without this the
    // ClientOnboarding screen renders "No trainers available"
    // because /api/operators only returns self for client viewers,
    // leaving the user stuck on step 1. This also self-heals any
    // orphan `op-google-XXXX` rows from the legacy OAuth auto-create
    // path which set trainerId=null.
    //
    // When public launch lands and we have multiple trainers, set
    // CLOSED_BETA_DEFAULT_TRAINER='' (empty string) to disable.
    const defaultTrainerId =
      process.env.CLOSED_BETA_DEFAULT_TRAINER ?? 'op-ruben';
    if (
      operator.role === 'client' &&
      !operator.trainerId &&
      defaultTrainerId &&
      defaultTrainerId !== operator.id
    ) {
      const trainer = await prisma.operator.findUnique({
        where: { id: defaultTrainerId },
        select: { id: true, role: true },
      });
      if (trainer && trainer.role === 'trainer') {
        operator = await prisma.operator.update({
          where: { id: operator.id },
          data: { trainerId: defaultTrainerId },
        });
        console.log(
          `[auth/me] auto-assigned trainerId=${defaultTrainerId} for client ${operator.id}`,
        );
      }
    }

    const { passwordHash: _, ...operatorData } = operator;

    return NextResponse.json({
      operator: {
        ...operatorData,
        intake: operatorData.intake as Record<string, unknown>,
        profile: operatorData.profile as Record<string, unknown>,
        nutrition: operatorData.nutrition as Record<string, unknown>,
        prs: operatorData.prs as unknown[],
        injuries: operatorData.injuries as unknown[],
        preferences: operatorData.preferences as Record<string, unknown>,
        workouts: operatorData.workouts as Record<string, unknown>,
        dayTags: operatorData.dayTags as Record<string, unknown>,
        sitrep: operatorData.sitrep as Record<string, unknown>,
        dailyBrief: operatorData.dailyBrief as Record<string, unknown>,
      },
    });
  } catch (error) {
    console.error('Auth check error:', error);
    return NextResponse.json(
      { error: 'Authentication check failed' },
      { status: 500 }
    );
  }
}
