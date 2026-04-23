import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';

// GET /api/operators — fetch operators visible to caller (auth required)
// Admins: all operators. Trainers: self + assigned clients. Clients: self only.
export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const isAdmin = OPS_CENTER_ACCESS.includes(auth.operatorId);
    const me = await prisma.operator.findUnique({ where: { id: auth.operatorId } });

    let rows;
    if (isAdmin) {
      rows = await prisma.operator.findMany();
    } else if (me?.role === 'trainer') {
      rows = await prisma.operator.findMany({
        where: {
          OR: [
            { id: auth.operatorId },
            { trainerId: auth.operatorId },
          ],
        },
      });
    } else {
      rows = me ? [me] : [];
    }

    // Convert DB rows back to the app's Operator shape.
    // NEVER include `pin` or `passwordHash` — pins are credentials and must not leak
    // to the client, even for admins browsing the OpsCenter. If pins are needed for
    // debugging, use /api/admin/debug (admin-secret-gated).
    const operators = rows.map(row => ({
      id: row.id,
      name: row.name,
      callsign: row.callsign,
      email: row.email,
      role: row.role,
      tier: row.tier,
      coupleWith: row.coupleWith,
      trainerId: row.trainerId,
      clientIds: row.clientIds,
      trainerNotes: row.trainerNotes,
      betaUser: row.betaUser,
      betaFeedback: row.betaFeedback,
      betaStartDate: row.betaStartDate,
      betaEndDate: row.betaEndDate,
      isVanguard: row.isVanguard,
      tierLocked: row.tierLocked,
      promoActive: row.promoActive,
      promoType: row.promoType,
      promoExpiry: row.promoExpiry,
      intake: row.intake as Record<string, unknown>,
      profile: row.profile as Record<string, unknown>,
      nutrition: row.nutrition as Record<string, unknown>,
      prs: row.prs as unknown[],
      injuries: row.injuries as unknown[],
      preferences: row.preferences as Record<string, unknown>,
      workouts: row.workouts as Record<string, unknown>,
      dayTags: row.dayTags as Record<string, unknown>,
      sitrep: row.sitrep as Record<string, unknown>,
      dailyBrief: row.dailyBrief as Record<string, unknown>,
      billing: row.billing as Record<string, unknown>,
    }));

    return NextResponse.json({ operators });
  } catch (error) {
    console.error('Failed to fetch operators:', error);
    return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 });
  }
}
