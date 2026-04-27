import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';
import { isEmailAuthorized, ALLOWLIST_REJECTION_MESSAGE } from '@/lib/authAllowlist';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, callsign } = body;

    // Validate inputs
    if (!email || !password || !name || !callsign) {
      return NextResponse.json(
        { error: 'Missing required fields: email, password, name, callsign' },
        { status: 400 }
      );
    }

    // Allowlist check — only AUTHORIZED_EMAILS may register an account.
    // 403 (not 401) so the client can distinguish "not authorized" from
    // "credentials wrong" and surface the right message.
    if (!isEmailAuthorized(email)) {
      return NextResponse.json(
        { error: ALLOWLIST_REJECTION_MESSAGE },
        { status: 403 },
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Validate callsign (alphanumeric + hyphens, uppercase)
    const callsignRegex = /^[A-Z0-9-]+$/;
    if (!callsignRegex.test(callsign)) {
      return NextResponse.json(
        { error: 'Callsign must be uppercase alphanumeric with hyphens only' },
        { status: 400 }
      );
    }

    // Check for duplicate email
    const existingByEmail = await prisma.operator.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingByEmail) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 409 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Generate operator ID (op-{callsign-lowercased})
    const operatorId = `op-${callsign.toLowerCase()}`;

    // Create operator
    const operator = await prisma.operator.create({
      data: {
        id: operatorId,
        name,
        callsign: callsign.toUpperCase(),
        pin: '', // No PIN for email-based users
        email: email.toLowerCase().trim(),
        passwordHash,
        role: 'client',
        tier: 'haiku',
        coupleWith: null,
        profile: {},
        nutrition: {},
        prs: [],
        injuries: [],
        preferences: {},
        workouts: {},
        dayTags: {},
      },
    });

    // Generate JWT token
    const token = generateToken(operator.id, operator.role);

    // Return operator without passwordHash
    const { passwordHash: _, ...operatorData } = operator;

    return NextResponse.json(
      {
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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
