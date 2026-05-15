// POST /api/admin/set-password
//
// Set or reset an operator's password. Mirrors set-pin and set-emails —
// admin-secret-gated, idempotent, supports both single-operator and
// bulk modes.
//
// Why this exists: closed-beta users seeded into the DB don't have a
// passwordHash — they were originally meant to log in by PIN. With
// the SSO migration to email/Google, some operators (especially
// iCloud users where Google sign-in is awkward) need a real password
// for the email/password form. This is the admin pathway to set one
// without a magic-link email round-trip (since email provider isn't
// wired yet).
//
// Auth: ADMIN_SECRET in `x-admin-secret` header.
//
// Body — pick ONE shape:
//
//   Single:
//     { operatorId: string, password: string }
//
//   Bulk:
//     { assignments: { "op-XXXX": "password1", "op-YYYY": "password2" } }
//
// Validation:
//   - Password must be ≥ 8 chars (matches /api/auth/register policy)
//   - Operator must exist
//   - Hash with bcrypt (cost 12, same as register)
//
// Response:
//   { ok, updated: [{ operatorId, callsign }],
//     skipped: [{ operatorId, reason }] }
//
// We never echo the plaintext password back, even on success.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 200;  // bcrypt truncates at 72 bytes anyway, but
                                   // accept up to 200 to support passphrases

interface UpdateResult { operatorId: string; callsign: string; }
interface SkipResult { operatorId: string; reason: string; }

function validatePassword(pw: unknown): { ok: true; value: string } | { ok: false; reason: string } {
  if (typeof pw !== 'string') return { ok: false, reason: 'password must be a string' };
  if (pw.length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (pw.length > MAX_PASSWORD_LENGTH) {
    return { ok: false, reason: `password must be at most ${MAX_PASSWORD_LENGTH} characters` };
  }
  return { ok: true, value: pw };
}

async function setOnePassword(operatorId: string, password: string): Promise<{
  updated?: UpdateResult;
  skipped?: SkipResult;
}> {
  const op = await prisma.operator.findUnique({ where: { id: operatorId } });
  if (!op) {
    return { skipped: { operatorId, reason: 'operator not found' } };
  }
  const passwordHash = await hashPassword(password);
  await prisma.operator.update({
    where: { id: operatorId },
    data: { passwordHash },
  });
  return { updated: { operatorId, callsign: op.callsign } };
}

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    // === BULK shape ===
    if (body?.assignments && typeof body.assignments === 'object') {
      const assignments: Record<string, unknown> = body.assignments;
      const updated: UpdateResult[] = [];
      const skipped: SkipResult[] = [];

      for (const [operatorId, raw] of Object.entries(assignments)) {
        const validation = validatePassword(raw);
        if (validation.ok !== true) {
          // Narrowing dodge — strict:false in tsconfig means TS won't
          // narrow validation to the failure branch automatically.
          skipped.push({ operatorId, reason: (validation as { reason: string }).reason });
          continue;
        }
        const result = await setOnePassword(operatorId, validation.value);
        if (result.updated) updated.push(result.updated);
        if (result.skipped) skipped.push(result.skipped);
      }

      return NextResponse.json({
        ok: true,
        updated,
        skipped,
        total: Object.keys(assignments).length,
      });
    }

    // === SINGLE shape ===
    const operatorId: string | undefined = body?.operatorId;
    if (!operatorId || typeof operatorId !== 'string') {
      return NextResponse.json({
        error: 'Provide either { operatorId, password } OR { assignments: { operatorId: password } }',
      }, { status: 400 });
    }
    const validation = validatePassword(body?.password);
    if (validation.ok !== true) {
      return NextResponse.json({
        error: (validation as { reason: string }).reason,
      }, { status: 400 });
    }
    const result = await setOnePassword(operatorId, validation.value);
    if (result.skipped) {
      return NextResponse.json({
        ok: false,
        ...result.skipped,
      }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...result.updated });
  } catch (error) {
    console.error('[admin/set-password] error', error);
    return NextResponse.json({
      error: 'Failed to set password',
      details: String(error),
    }, { status: 500 });
  }
}
