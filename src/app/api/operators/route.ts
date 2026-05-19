import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireTrainerAuth } from '@/lib/requireTrainerAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';

// GET /api/operators — fetch operators visible to caller (auth required)
// Admins: all operators. Trainers: self + assigned clients. Clients: self only.
export async function GET(req: NextRequest) {
  const auth = requireTrainerAuth(req);
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
      // Clients: self + any junior operators where this client is listed
      // as a parent + ALL trainers. Without the junior expansion, parents
      // (WARDOG / PHOENIX) wouldn't see their kids and PARENT HUB breaks.
      // Without the trainer expansion, the ClientOnboarding screen renders
      // "No trainers available" for any client whose trainerId isn't set,
      // and they get stuck on step 1 with no way forward.
      rows = await prisma.operator.findMany({
        where: {
          OR: [
            { id: auth.operatorId },
            { isJunior: true, parentIds: { has: auth.operatorId } },
            { role: 'trainer' },
          ],
        },
      });
    }

    // Spread-with-denylist projection.
    //
    // The old shape was a hand-picked allowlist of ~30 fields. That
    // pattern is what caused PRs #153 (macroCycles write), #155
    // (provision junior fields), and #163 (macroCycles read) — every
    // time a new column landed on Operator, somebody had to remember
    // to update this list, and three separate times nobody did. The
    // operator's data round-tripped through this route and quietly
    // lost the new field.
    //
    // Inverted: spread the whole row, then DELETE the credentials.
    // New schema columns ride through automatically. The denylist is
    // small + auditable + the security invariant is local rather
    // than implicit-by-omission.
    //
    // Denylist rationale:
    //   - pin:          login credential (Web PIN entry)
    //   - passwordHash: bcrypt; never client-visible
    //   - googleId:     OAuth subject id; we don't need it client-side
    //                   and it's recoverable evidence of a user's
    //                   Google identity
    // If a future column lands that ALSO must not leak (API tokens,
    // billing PII, etc.), add it to the destructure here.
    const operators = rows.map(row => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { pin, passwordHash, googleId, ...safe } = row;
      return safe;
    });

    return NextResponse.json({ operators });
  } catch (error) {
    console.error('Failed to fetch operators:', error);
    return NextResponse.json({ error: 'Failed to fetch operators' }, { status: 500 });
  }
}
