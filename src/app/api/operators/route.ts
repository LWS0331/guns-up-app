import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/operators — fetch all operators
export async function GET() {
  try {
    const rows = await prisma.operator.findMany();

    // Convert DB rows back to the app's Operator shape
    const operators = rows.map(row => ({
      id: row.id,
      name: row.name,
      callsign: row.callsign,
      pin: row.pin,
      role: row.role,
      tier: row.tier,
      coupleWith: row.coupleWith,
      trainerId: row.trainerId,
      clientIds: row.clientIds,
      trainerNotes: row.trainerNotes,
      betaUser: row.betaUser,
      betaFeedback: row.betaFeedback,
      profile: row.profile as Record<string, unknown>,
      nutrition: row.nutrition as Record<string, unknown>,
      prs: row.prs as unknown[],
      injuries: row.injuries as unknown[],
      preferences: row.preferences as Record<string, unknown>,
      workouts: row.workouts as Record<string, unknown>,
      dayTags: row.dayTags as Record<string, unknown>,
    }));

    return NextResponse.json({ operators });
  } catch (error) {
    console.error('Failed to fetch operators:', error);
    return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 });
  }
}
