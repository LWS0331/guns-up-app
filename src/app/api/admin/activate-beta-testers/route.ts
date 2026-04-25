import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// POST /api/admin/activate-beta-testers
//
// One-shot, idempotent admin endpoint to set `tier='opus'` (COMMANDER)
// and `betaUser=true` for the four named beta-tester operators on the
// LIVE database. Built because:
//
//   • The static OPERATORS seed in src/data/operators.ts had these four
//     on lower tiers (sonnet / sonnet / haiku / sonnet) with betaUser
//     already true.
//   • /api/seed (force) updates `tier` but DELIBERATELY excludes
//     `betaUser` from its update path — see seed/route.ts:56 — so a
//     force-seed would only catch the tier change, not betaUser.
//   • /api/seed (no force) skips operators that already exist in the DB,
//     which the four beta testers already do.
//
// So neither existing admin path will reliably flip both fields for
// these specific operators. This endpoint hard-codes the four IDs and
// upserts both fields directly. It is idempotent (safe to call multiple
// times) and only touches the four operators by ID — no spillover risk
// to other accounts.
//
// Auth: requires ADMIN_SECRET in the `x-admin-secret` header (same
// header model as /api/seed and /api/admin/reset).
//
// Invocation:
//   curl -X POST https://gunsup.app/api/admin/activate-beta-testers \
//     -H "x-admin-secret: $ADMIN_SECRET"
//
// Response shape:
//   { ok: true, updated: [{ id, tier, betaUser, callsign }], skipped: [...] }

const BETA_TESTER_IDS = [
  'op-aldo',
  'op-efrain',
  'op-erika',
  'op-edgar',
] as const;

const TARGET_TIER = 'opus' as const;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const updated: Array<{ id: string; callsign: string; tier: string; betaUser: boolean }> = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  try {
    for (const id of BETA_TESTER_IDS) {
      const existing = await prisma.operator.findUnique({ where: { id } });
      if (!existing) {
        // Operator missing entirely — likely the seed never ran or the
        // ID is stale. Don't auto-create here; that would mask a real
        // configuration problem. Caller should hit /api/seed first.
        skipped.push({ id, reason: 'not_found_in_db' });
        continue;
      }

      const result = await prisma.operator.update({
        where: { id },
        data: {
          tier: TARGET_TIER,
          betaUser: true,
        },
        select: {
          id: true,
          callsign: true,
          tier: true,
          betaUser: true,
        },
      });
      updated.push(result);
    }

    return NextResponse.json({
      ok: true,
      targetTier: TARGET_TIER,
      updated,
      skipped,
      total: BETA_TESTER_IDS.length,
    });
  } catch (error) {
    console.error('[activate-beta-testers] failed:', error);
    return NextResponse.json(
      { error: 'Update failed', details: String(error) },
      { status: 500 },
    );
  }
}

// GET — read-only inspection so the caller can verify state without
// touching anything. Same auth model.
export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await prisma.operator.findMany({
      where: { id: { in: [...BETA_TESTER_IDS] } },
      select: { id: true, callsign: true, name: true, tier: true, betaUser: true, role: true },
    });
    return NextResponse.json({ ok: true, rows, expected: BETA_TESTER_IDS });
  } catch (error) {
    console.error('[activate-beta-testers:GET] failed:', error);
    return NextResponse.json(
      { error: 'Read failed', details: String(error) },
      { status: 500 },
    );
  }
}
