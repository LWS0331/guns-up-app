import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';
import { isOperatorAllowed, NOT_ALLOWED_RESPONSE } from '@/lib/allowlist';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, pin } = body;

    // Backward compatibility: support PIN login during beta
    if (pin) {
      const operator = await prisma.operator.findFirst({
        where: { pin },
      });

      if (!operator) {
        return NextResponse.json(
          { error: 'Invalid PIN' },
          { status: 401 }
        );
      }

      // Closed-beta allowlist gate. Operators without an assigned email
      // (and not in OPS_CENTER_ACCESS) cannot authenticate, even with a
      // valid PIN. Activation = admin assigns email via /api/admin/set-emails.
      if (!isOperatorAllowed(operator)) {
        return NextResponse.json(NOT_ALLOWED_RESPONSE, { status: 403 });
      }

      const token = generateToken(operator.id, operator.role);

      const { passwordHash: _, ...operatorData } = operator;

      return NextResponse.json({
        token,
        operator: {
          ...operatorData,
          profile: operatorData.profile as Record<string, unknown>,
          nutrition: operatorData.nutrition as Record<string, unknown>,
          prs: operatorData.prs as unknown[],
          injuries: operatorData.injuries as unknown[],
          preferences: operatorData.preferences as Record<string, unknown>,
          workouts: operatorData.workouts as Record<string, unknown>,
          dayTags: operatorData.dayTags as Record<string, unknown>,
        },
      });
    }

    // Email/password login
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Missing email or password' },
        { status: 400 }
      );
    }

    const operator = await prisma.operator.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!operator || !operator.passwordHash) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const passwordValid = await verifyPassword(password, operator.passwordHash);

    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Allowlist gate (defense in depth — email-path login means this
    // operator has an email by definition, but admins can also nullify
    // an email later to revoke access without deleting the row).
    if (!isOperatorAllowed(operator)) {
      return NextResponse.json(NOT_ALLOWED_RESPONSE, { status: 403 });
    }

    const token = generateToken(operator.id, operator.role);

    const { passwordHash: _, ...operatorData } = operator;

    return NextResponse.json({
      token,
      operator: {
        ...operatorData,
        profile: operatorData.profile as Record<string, unknown>,
        nutrition: operatorData.nutrition as Record<string, unknown>,
        prs: operatorData.prs as unknown[],
        injuries: operatorData.injuries as unknown[],
        preferences: operatorData.preferences as Record<string, unknown>,
        workouts: operatorData.workouts as Record<string, unknown>,
        dayTags: operatorData.dayTags as Record<string, unknown>,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
