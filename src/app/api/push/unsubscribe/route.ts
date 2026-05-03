// /api/push/unsubscribe — drop a Web Push subscription. Phase 2C.
//
// Two valid bodies:
//   { endpoint }                — drop one specific subscription
//   { allForOperator: true }    — drop ALL subscriptions for the
//                                 authenticated operator (used by the
//                                 "turn off notifications everywhere" UI)

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';

interface UnsubscribeBody {
  endpoint?: string;
  allForOperator?: boolean;
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: UnsubscribeBody;
  try {
    body = (await req.json()) as UnsubscribeBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (body.allForOperator) {
    const result = await prisma.pushSubscription.deleteMany({
      where: { operatorId: auth.operatorId },
    });
    return NextResponse.json({ ok: true, deleted: result.count });
  }

  if (typeof body.endpoint !== 'string') {
    return NextResponse.json(
      { error: 'endpoint required (or allForOperator: true)' },
      { status: 400 },
    );
  }

  // Only allow deleting subscriptions the caller owns. Browsers
  // shouldn't be able to clear another operator's endpoint by knowing it.
  const sub = await prisma.pushSubscription.findUnique({
    where: { endpoint: body.endpoint },
  });
  if (!sub) {
    return NextResponse.json({ ok: true, deleted: 0 });
  }
  if (sub.operatorId !== auth.operatorId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.pushSubscription.delete({ where: { endpoint: body.endpoint } });
  return NextResponse.json({ ok: true, deleted: 1 });
}
