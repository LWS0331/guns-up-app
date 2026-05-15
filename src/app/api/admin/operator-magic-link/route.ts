// POST /api/admin/operator-magic-link
//
// Admin endpoint to mint a magic-link recovery token for any operator
// and return a copy-able URL. Lets the OPS Center surface a "SEND LINK"
// button per row without depending on the email provider being wired —
// the admin pastes the URL into Slack/SMS/DM and the user taps to land
// authenticated on /auth/magic.
//
// Why not reuse POST /api/auth/magic-link?
//   - That endpoint is public + email-keyed; the queue-an-email side
//     effect goes nowhere in production today (EMAIL_PROVIDER=console).
//   - Admins want the URL itself, not a fire-and-forget queue write.
//   - Operator ID is more reliable than email-by-typo, especially for
//     accounts whose Operator.email got nulled.
//
// Auth: session JWT + OPS_CENTER_ACCESS membership. Same gate as
// /api/admin/operator-status (disable / enable / delete buttons).
//
// Body:
//   { operatorId: string }
//
// Response:
//   200 { ok, url, token, expiresAt, ttlSeconds, operator: { id, callsign, email } }
//   401 { error: 'Unauthorized' }
//   403 { error: 'Admin only' }
//   404 { error: 'Operator not found' }

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { OPS_CENTER_ACCESS } from '@/lib/types';
import { mintToken } from '@/lib/authTokens';

function buildBaseUrl(req: NextRequest): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.HOST_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  return new URL(req.url).origin;
}

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;
  if (!OPS_CENTER_ACCESS.includes(auth.operatorId)) {
    return NextResponse.json({ error: 'Admin only' }, { status: 403 });
  }

  let body: { operatorId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const operatorId = typeof body?.operatorId === 'string' ? body.operatorId.trim() : '';
  if (!operatorId) {
    return NextResponse.json({ error: 'operatorId required' }, { status: 400 });
  }

  const op = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { id: true, callsign: true, email: true },
  });
  if (!op) {
    return NextResponse.json({ error: 'Operator not found' }, { status: 404 });
  }

  const minted = await mintToken({
    operatorId: op.id,
    type: 'magic_link',
    intent: 'admin_recovery',
    metadata: { issuedBy: auth.operatorId },
  });

  const baseUrl = buildBaseUrl(req);
  const url = `${baseUrl}/auth/magic?token=${encodeURIComponent(minted.token)}`;

  return NextResponse.json({
    ok: true,
    url,
    token: minted.token,
    expiresAt: minted.expiresAt,
    ttlSeconds: minted.ttlSeconds,
    operator: { id: op.id, callsign: op.callsign, email: op.email },
  });
}
