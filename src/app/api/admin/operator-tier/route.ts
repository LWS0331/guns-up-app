// /api/admin/operator-tier — set any operator's tier directly.
//
// Built May 2026 immediately after a tier-rebalance regression
// demoted the founder's own account due to a trailing-space typo
// in callsign matching. General-purpose admin tool: takes an
// operator id + target tier + optional tierLocked flag, applies
// atomically, returns the before/after.
//
// POST body:
//   {
//     "operatorId": "op-ruben",
//     "tier": "opus" | "sonnet" | "haiku" | "white_glove",
//     "tierLocked"?: boolean,        // optional, default unchanged
//     "trimCallsign"?: boolean       // optional, strip whitespace
//                                     from operator.callsign while
//                                     we're at it
//   }
//
// Auth: OPS_CENTER_ACCESS only.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';

const VALID_TIERS = ['haiku', 'sonnet', 'opus', 'white_glove'] as const;
type Tier = (typeof VALID_TIERS)[number];

interface SetTierBody {
  operatorId?: string;
  tier?: string;
  tierLocked?: boolean;
  trimCallsign?: boolean;
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!OPS_CENTER_ACCESS.includes(auth.operatorId)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: SetTierBody;
  try {
    body = (await req.json()) as SetTierBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const operatorId = typeof body.operatorId === 'string' ? body.operatorId.trim() : '';
  const tier = typeof body.tier === 'string' ? body.tier.trim() : '';

  if (!operatorId) {
    return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
  }
  if (!VALID_TIERS.includes(tier as Tier)) {
    return NextResponse.json(
      {
        error: `Invalid tier '${tier}'. Must be one of: ${VALID_TIERS.join(', ')}`,
      },
      { status: 400 },
    );
  }

  const before = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { id: true, callsign: true, tier: true, tierLocked: true, role: true },
  });
  if (!before) {
    return NextResponse.json(
      { error: `Operator '${operatorId}' not found` },
      { status: 404 },
    );
  }

  // Build the patch. tierLocked is optional — only update when caller
  // explicitly passes it. Same for callsign trimming.
  const data: {
    tier: Tier;
    tierLocked?: boolean;
    callsign?: string;
  } = { tier: tier as Tier };
  if (typeof body.tierLocked === 'boolean') data.tierLocked = body.tierLocked;
  if (body.trimCallsign === true && before.callsign !== before.callsign.trim()) {
    data.callsign = before.callsign.trim();
  }

  const after = await prisma.operator.update({
    where: { id: operatorId },
    data,
    select: { id: true, callsign: true, tier: true, tierLocked: true, role: true },
  });

  // eslint-disable-next-line no-console
  console.log('[operator-tier] applied', {
    actor: auth.operatorId,
    target: operatorId,
    tierBefore: before.tier,
    tierAfter: after.tier,
    callsignBefore: before.callsign,
    callsignAfter: after.callsign,
    tierLockedAfter: after.tierLocked,
  });

  return NextResponse.json({
    ok: true,
    before,
    after,
    callsignTrimmed:
      before.callsign !== after.callsign,
  });
}
