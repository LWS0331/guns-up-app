import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getVitalClient } from '@/lib/vital';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import { planWearableReconcile, type VitalProviderStatus } from '@/lib/wearableReconcile';

// POST /api/wearables/reconcile — webhook-independent connection recovery.
//
// Resolves the operator's Vital user by clientUserId (guns-up-{id}),
// asks Vital which providers are actually connected, and reconciles the
// local WearableConnection rows to match. This is the self-heal path for
// when the `provider.connection.created` webhook was missed — without it
// an operator can be stuck at `connections: []` forever and /sync 404s.
//
// AUTH: self or admin (mirrors /connect and /sync). Does NOT create a
// Vital user — if none exists the operator simply hasn't linked yet.
export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { operatorId } = await req.json();
    if (!operatorId) {
      return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
    }

    const isSelf = auth.operatorId === operatorId;
    const isAdmin = OPS_CENTER_ACCESS.includes(auth.operatorId);
    if (!isSelf && !isAdmin) {
      console.warn('[api/wearables/reconcile] FORBIDDEN', { actor: auth.operatorId, target: operatorId });
      return NextResponse.json({ error: 'Forbidden: cannot reconcile wearables for another operator' }, { status: 403 });
    }

    if (!process.env.VITAL_API_KEY) {
      return NextResponse.json({ error: 'Wearable integration not configured' }, { status: 503 });
    }

    const vital = getVitalClient();
    const clientUserId = `guns-up-${operatorId}`;

    // Resolve the Vital user without relying on a local row. A 404 here
    // means the operator never created a Vital user (never started a
    // link) — surface that as a clean "link first", not an error.
    let vitalUserId: string;
    try {
      const vitalUser = await vital.user.getByClientUserId(clientUserId);
      vitalUserId = vitalUser.userId;
    } catch (err) {
      const statusCode = (err as { statusCode?: number })?.statusCode;
      if (statusCode === 404) {
        return NextResponse.json({
          ok: true,
          vitalUserFound: false,
          activated: 0,
          deactivated: 0,
          message: 'No Junction/Vital user for this operator yet — complete a wearable link first.',
        });
      }
      throw err;
    }

    // Ask Vital which providers are actually connected. Response is keyed
    // (e.g. { providers: [...] }); flatten all values defensively.
    const connectedResp = await vital.user.getConnectedProviders(vitalUserId);
    const vitalProviders: VitalProviderStatus[] = Object.values(connectedResp ?? {})
      .flat()
      .map((p) => ({ slug: p.slug, name: p.name, status: p.status }));

    const existingRows = await prisma.wearableConnection.findMany({
      where: { operatorId },
      select: { id: true, provider: true, active: true },
    });

    const plan = planWearableReconcile(vitalProviders, existingRows);

    // Apply: reactivate/create connected providers, deactivate stale ones.
    // Upsert on the (operatorId, provider) unique key rather than create —
    // race-safe against the webhook inserting the same row between our
    // findMany read above and this write, and idempotent on re-runs.
    for (const a of plan.activate) {
      await prisma.wearableConnection.upsert({
        where: { operatorId_provider: { operatorId, provider: a.provider } },
        update: { active: true, vitalUserId, connectedAt: new Date() },
        create: {
          operatorId,
          vitalUserId,
          provider: a.provider,
          providerName: a.name || a.provider,
          active: true,
        },
      });
    }
    for (const d of plan.deactivate) {
      await prisma.wearableConnection.update({
        where: { id: d.id },
        data: { active: false },
      });
    }

    return NextResponse.json({
      ok: true,
      vitalUserFound: true,
      activated: plan.activate.length,
      deactivated: plan.deactivate.length,
      connectedProviders: vitalProviders.filter((p) => p.status.toLowerCase() === 'connected').map((p) => p.slug),
      // Hint the client to run /sync next to backfill snapshots for any
      // newly-(re)activated connection.
      syncRecommended: plan.activate.length > 0,
    });
  } catch (error) {
    console.error('[api/wearables/reconcile] error', error);
    return NextResponse.json(
      { error: 'Failed to reconcile wearables', details: String(error) },
      { status: 500 },
    );
  }
}
