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

    const operator = await prisma.operator.findUnique({
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
