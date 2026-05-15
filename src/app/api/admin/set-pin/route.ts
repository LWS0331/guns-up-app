// POST /api/admin/set-pin — reset an operator's PIN.
//
// Standalone admin endpoint so the platform owner can rotate their own
// PIN (and any other operator's PIN) without going through the app UI.
// Useful when:
//   - The seed default PIN got promoted to prod and you want yours back
//   - A user forgot their PIN and the recovery flow isn't sufficient
//   - You're rotating PINs after an incident
//
// Auth: ADMIN_SECRET in `x-admin-secret` header. Same protection as
// /api/migrate and /api/seed — never put the secret in a query param.
//
// Body: { operatorId: string, pin: string }
//   - pin must be 4 digits

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const operatorId: string | undefined = body?.operatorId;
    const pin: string | undefined = body?.pin;

    if (!operatorId || typeof operatorId !== 'string') {
      return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
    }
    if (!pin || typeof pin !== 'string' || !/^\d{4}$/.test(pin)) {
      return NextResponse.json({
        error: 'pin must be exactly 4 digits',
      }, { status: 400 });
    }

    const op = await prisma.operator.findUnique({ where: { id: operatorId } });
    if (!op) {
      return NextResponse.json({ error: 'Operator not found', operatorId }, { status: 404 });
    }

    await prisma.operator.update({
      where: { id: operatorId },
      data: { pin },
    });

    return NextResponse.json({
      ok: true,
      message: `PIN updated for ${op.callsign} (${operatorId})`,
    });
  } catch (error) {
    console.error('[admin/set-pin] error', error);
    return NextResponse.json({
      error: 'Failed to set PIN',
      details: String(error),
    }, { status: 500 });
  }
}
