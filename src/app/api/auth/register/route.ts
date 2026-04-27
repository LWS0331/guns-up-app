import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword, generateToken } from '@/lib/auth';

// Public registration is CLOSED until June 2026 (Pricing Strategy v2 §6).
// During the closed beta, operators are seeded by admin via /api/admin/
// set-emails — there is no self-serve sign-up path.
//
// We refuse this endpoint at the door before doing any DB work or even
// validating the body, so a probing attacker gets the same fast 403
// regardless of payload shape. The override lets us re-open it later
// without redeploying the whole binary.
const REGISTRATION_OPEN = process.env.REGISTRATION_OPEN === '1';
const CLOSED_BETA_REJECTION = {
  error: 'Registration closed',
  message: 'Public registration opens June 2026. GUNS UP is currently in closed beta. Contact Ruben to request access.',
};

export async function POST(request: NextRequest) {
  if (!REGISTRATION_OPEN) {
    return NextResponse.json(CLOSED_BETA_REJECTION, { status: 403 });
  }
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
