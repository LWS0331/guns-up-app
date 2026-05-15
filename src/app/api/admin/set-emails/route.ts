// POST /api/admin/set-emails
//
// Bulk operator email assignment — takes a map of operatorId → email
// and writes each one. Idempotent, lowercases, validates format. Used
// to wire the canonical "Operator Emails" allowlist (closed-beta active
// users) onto the seeded operator records so email-based login + the
// recovery wizard work.
//
// Auth: ADMIN_SECRET in `x-admin-secret` header.
//
// Body:
//   { assignments: { "op-erika": "Erikruz.1086@gmail.com", ... } }
//
// Response:
//   { ok, updated: [{ operatorId, callsign, email }],
//     skipped: [{ operatorId, reason }] }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface UpdateResult {
  operatorId: string;
  callsign: string;
  email: string;
}

interface SkipResult {
  operatorId: string;
  reason: string;
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const assignments: Record<string, string> | undefined = body?.assignments;

    if (!assignments || typeof assignments !== 'object') {
      return NextResponse.json({
        error: 'assignments object required, shape: { operatorId: email }',
      }, { status: 400 });
    }

    const updated: UpdateResult[] = [];
    const skipped: SkipResult[] = [];

    for (const [operatorId, rawEmail] of Object.entries(assignments)) {
      if (typeof rawEmail !== 'string') {
        skipped.push({ operatorId, reason: 'email not a string' });
        continue;
      }
      const email = rawEmail.trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        skipped.push({ operatorId, reason: `invalid email: ${rawEmail}` });
        continue;
      }
      const op = await prisma.operator.findUnique({ where: { id: operatorId } });
      if (!op) {
        skipped.push({ operatorId, reason: 'operator not found' });
        continue;
      }
      // If another operator already owns that email, surface it instead
      // of throwing on the unique constraint.
      const collision = await prisma.operator.findFirst({
        where: { email, id: { not: operatorId } },
      });
      if (collision) {
        skipped.push({
          operatorId,
          reason: `email collision: already owned by ${collision.id} (${collision.callsign})`,
        });
        continue;
      }
      await prisma.operator.update({
        where: { id: operatorId },
        data: { email },
      });
      updated.push({ operatorId, callsign: op.callsign, email });
    }

    return NextResponse.json({
      ok: true,
      updated,
      skipped,
      total: Object.keys(assignments).length,
    });
  } catch (error) {
    console.error('[admin/set-emails] error', error);
    return NextResponse.json({
      error: 'Failed to set emails',
      details: String(error),
    }, { status: 500 });
  }
}
