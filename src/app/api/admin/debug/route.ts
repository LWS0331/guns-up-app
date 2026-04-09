import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// GET /api/admin/debug — check operator PINs (requires ADMIN_SECRET)
export async function GET(req: NextRequest) {
  const secret = new URL(req.url).searchParams.get('secret');
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
