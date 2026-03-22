import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword, generateToken } from '@/lib/auth';

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
