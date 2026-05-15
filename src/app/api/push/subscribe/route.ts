// /api/push/subscribe — register a Web Push subscription against the
// authenticated operator. Phase 2C.
//
// The client gets the subscription object back from
// `serviceWorkerRegistration.pushManager.subscribe(...)` — we forward
// that here, plus an optional platform hint, and upsert the row.
//
// Endpoint uniqueness is enforced at the DB layer (@@unique on
// PushSubscription.endpoint). If the same endpoint already belongs to
// a different operator (rare — shared device hand-down), we re-target
// it to the current operator rather than reject.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';

interface SubscribeBody {
  subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  };
  platform?: 'ios-pwa' | 'desktop' | 'android' | 'unknown';
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  let body: SubscribeBody;
  try {
    body = (await req.json()) as SubscribeBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const sub = body?.subscription;
  if (
    !sub ||
    typeof sub.endpoint !== 'string' ||
    !sub.keys ||
    typeof sub.keys.p256dh !== 'string' ||
    typeof sub.keys.auth !== 'string'
  ) {
    return NextResponse.json(
      { error: 'subscription { endpoint, keys: { p256dh, auth } } required' },
      { status: 400 },
    );
  }

  const platform = ['ios-pwa', 'desktop', 'android', 'unknown'].includes(
    body.platform ?? '',
  )
    ? (body.platform as string)
    : 'unknown';

  const upserted = await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: {
      operatorId: auth.operatorId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      platform,
    },
    update: {
      operatorId: auth.operatorId,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      platform,
      notificationsOn: true,
      lastSeenAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    subscriptionId: upserted.id,
    platform: upserted.platform,
  });
}
