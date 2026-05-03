// /api/admin/operator-provision — create a missing Operator row in
// production from the static seed config.
//
// Built May 2026 immediately after the tier-rebalance dry-run
// surfaced that Britney's account (op-britney VALKYRIE) was in the
// static `src/data/operators.ts` seed but had never been written to
// production Postgres. Same pattern likely applies to other
// statically-defined operators that were added after the original
// seed run.
//
// Idempotent: if the row already exists, return it without
// modification (no overwrite). To rewrite an existing row use the
// dedicated /api/admin/operator-tier endpoint or update intake JSON
// directly.
//
// POST body:
//   { "operatorId": "op-britney" }
//
// Response includes a `created: bool` flag so the caller knows
// whether the row already existed.
//
// Auth: OPS_CENTER_ACCESS only.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import { OPERATORS } from '@/data/operators';

interface ProvisionBody {
  operatorId?: string;
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!OPS_CENTER_ACCESS.includes(auth.operatorId)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: ProvisionBody;
  try {
    body = (await req.json()) as ProvisionBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const operatorId = typeof body.operatorId === 'string' ? body.operatorId.trim() : '';
  if (!operatorId) {
    return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
  }

  // Check the static seed for this id.
  const seed = OPERATORS.find((op) => op.id === operatorId);
  if (!seed) {
    return NextResponse.json(
      {
        error: `Operator '${operatorId}' is not in the static seed (src/data/operators.ts)`,
      },
      { status: 404 },
    );
  }

  // Idempotency check.
  const existing = await prisma.operator.findUnique({ where: { id: operatorId } });
  if (existing) {
    return NextResponse.json({
      ok: true,
      created: false,
      message: 'Operator already exists in production — no changes.',
      operator: {
        id: existing.id,
        callsign: existing.callsign,
        tier: existing.tier,
        role: existing.role,
      },
    });
  }

  // Create the row from the seed. We project the seed shape onto the
  // Operator model — most JSON-column fields default to {} or [] in
  // the schema, so we only write the columns we have direct values
  // for and let Prisma's defaults handle the rest.
  const created = await prisma.operator.create({
    data: {
      id: seed.id,
      name: seed.name,
      callsign: seed.callsign,
      pin: seed.pin,
      role: seed.role,
      tier: seed.tier,
      personaId: seed.personaId ?? null,
      coupleWith: seed.coupleWith ?? null,
      trainerId: seed.trainerId ?? null,
      clientIds: seed.clientIds ?? [],
      betaUser: seed.betaUser ?? false,
      // JSON columns from seed — cast through unknown to satisfy
      // Prisma's strict input types without losing shape.
      profile: (seed.profile ?? {}) as object,
      preferences: (seed.preferences ?? {}) as object,
      nutrition: (seed.nutrition ?? {}) as object,
      prs: (seed.prs ?? []) as object,
      injuries: (seed.injuries ?? []) as object,
      workouts: (seed.workouts ?? {}) as object,
      dayTags: (seed.dayTags ?? {}) as object,
      sitrep: (seed.sitrep ?? {}) as object,
      dailyBrief: (seed.dailyBrief ?? {}) as object,
      // Optional fields that the schema accepts but the seed may not have
      ...(seed.email ? { email: seed.email } : {}),
      ...(seed.trainerNotes ? { trainerNotes: seed.trainerNotes } : {}),
    },
  });

  // eslint-disable-next-line no-console
  console.log('[operator-provision] created', {
    actor: auth.operatorId,
    target: operatorId,
    callsign: created.callsign,
    tier: created.tier,
    role: created.role,
  });

  return NextResponse.json({
    ok: true,
    created: true,
    message: `Operator '${operatorId}' provisioned from static seed.`,
    operator: {
      id: created.id,
      callsign: created.callsign,
      tier: created.tier,
      role: created.role,
      name: created.name,
    },
  });
}
