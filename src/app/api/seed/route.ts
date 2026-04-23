import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { OPERATORS } from '@/data/operators';

// Helper to convert any value to a clean JSON-compatible value for Prisma
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toJson = (val: any) => JSON.parse(JSON.stringify(val ?? {}));
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const toJsonArray = (val: any) => JSON.parse(JSON.stringify(val ?? []));

// POST /api/seed — seed the database with default operators
// Only inserts operators that don't already exist (won't overwrite user data unless ?force).
// Requires ADMIN_SECRET in the `x-admin-secret` header. Query-param support was removed
// so the secret doesn't leak into access logs.
export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { force } = await req.json().catch(() => ({ force: false }));

  try {
    let created = 0;
    let skipped = 0;
    let identityUpdated = 0;

    for (const op of OPERATORS) {
      const existing = await prisma.operator.findUnique({ where: { id: op.id } });

      if (existing && !force) {
        skipped++;
        continue;
      }

      await prisma.operator.upsert({
        where: { id: op.id },
        // `force` used to overwrite profile/nutrition/prs/injuries/preferences/
        // workouts/dayTags with static seed values, which wiped every bit of user
        // data for any operator already in the DB. Restrict the force-update set
        // to identity + routing fields so operators can re-sync their name,
        // callsign, role, tier, trainer relationships from the OPERATORS file
        // without destroying their training history. User-generated JSON columns
        // are left untouched on force.
        update: force ? {
          name: op.name,
          callsign: op.callsign,
          role: op.role,
          tier: op.tier,
          coupleWith: op.coupleWith ?? null,
          trainerId: op.trainerId ?? null,
          clientIds: op.clientIds ?? [],
          trainerNotes: op.trainerNotes ?? null,
          // NOTE: `pin` intentionally excluded from force — overwriting PINs would
          // silently reset user credentials. Use /api/admin/reset for that.
          // NOTE: betaUser / betaFeedback / profile / nutrition / prs / injuries /
          // preferences / workouts / dayTags all intentionally excluded.
        } : {},
        create: {
          id: op.id,
          name: op.name,
          callsign: op.callsign,
          pin: op.pin,
          role: op.role,
          tier: op.tier,
          coupleWith: op.coupleWith ?? null,
          trainerId: op.trainerId ?? null,
          clientIds: op.clientIds ?? [],
          trainerNotes: op.trainerNotes ?? null,
          betaUser: op.betaUser ?? false,
          betaFeedback: op.betaFeedback ?? [],
          profile: toJson(op.profile),
          nutrition: toJson(op.nutrition),
          prs: toJsonArray(op.prs),
          injuries: toJsonArray(op.injuries),
          preferences: toJson(op.preferences),
          workouts: toJson(op.workouts),
          dayTags: toJson(op.dayTags),
        },
      });
      if (existing) identityUpdated++;
      else created++;
    }

    return NextResponse.json({
      ok: true,
      created,
      skipped,
      identityUpdated,
      total: OPERATORS.length,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed', details: String(error) }, { status: 500 });
  }
}
