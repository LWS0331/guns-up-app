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

    for (const op of OPERATORS) {
      const existing = await prisma.operator.findUnique({ where: { id: op.id } });

      if (existing && !force) {
        skipped++;
        continue;
      }

      await prisma.operator.upsert({
        where: { id: op.id },
        update: force ? {
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
      created++;
    }

    return NextResponse.json({
      ok: true,
      created,
      skipped,
      total: OPERATORS.length,
    });
  } catch (error) {
    console.error('Seed error:', error);
    return NextResponse.json({ error: 'Seed failed', details: String(error) }, { status: 500 });
  }
}
