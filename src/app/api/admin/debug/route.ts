import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/admin/debug — check operator PINs. Requires ADMIN_SECRET in the
// `x-admin-secret` header only. Query-string secret was removed because it
// would appear in access logs, proxy logs, and browser history — and this
// endpoint returns PINs (equivalent to passwords), so leaking the secret is
// account-takeover critical.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const ops = await prisma.operator.findMany({
      select: { id: true, name: true, callsign: true, pin: true, email: true, role: true },
    });
    return NextResponse.json({ operators: ops });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
