import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/admin/debug — operator account-state snapshot. Requires
// ADMIN_SECRET in the `x-admin-secret` header only. Query-string
// secret was removed because it would appear in access logs, proxy
// logs, and browser history — and this endpoint returns PINs
// (equivalent to passwords), so leaking the secret is account-takeover
// critical.
//
// Returned fields chosen to support the most common diagnostic loops:
//   - id / name / callsign / role / tier / betaUser → identification + entitlement
//   - pin       → backup login (server-side /api/auth/login accepts)
//   - email     → closed-beta allowlist membership (isOperatorAllowed
//                 gate). NULL = locked out of every auth path.
//   - googleId  → OAuth link state. NULL = first Google sign-in will
//                 hit the email-match path. NON-NULL = Google sign-in
//                 resolves directly via this id (no email match needed).
//   - hasPassword → is email/password login viable? Boolean only —
//                 never expose the hash itself.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const ops = await prisma.operator.findMany({
      select: {
        id: true,
        name: true,
        callsign: true,
        pin: true,
        email: true,
        googleId: true,
        passwordHash: true,
        tier: true,
        betaUser: true,
        role: true,
      },
    });
    const operators = ops.map((o) => ({
      id: o.id,
      name: o.name,
      callsign: o.callsign,
      pin: o.pin,
      email: o.email,
      googleId: o.googleId,
      hasPassword: o.passwordHash != null && o.passwordHash.length > 0,
      tier: o.tier,
      betaUser: o.betaUser,
      role: o.role,
    }));
    return NextResponse.json({ operators });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
