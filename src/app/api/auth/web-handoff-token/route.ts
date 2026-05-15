// POST /api/auth/web-handoff-token
//
// Generates a single-use 5-minute token the iOS app uses to hand the
// authenticated session off to the web for a tier upgrade. The web
// /upgrade page consumes the token, creates a server session for that
// operator, and renders the Stripe checkout inline. Without this
// token the user would have to sign in again on the web — friction
// that we know empirically kills upgrade conversion.
//
// Caller (iOS):
//   POST /api/auth/web-handoff-token
//   Authorization: Bearer <user JWT>
//   { intent: 'upgrade', targetTier: 'opus' }
//
// Response:
//   { token, redirectUrl, expiresAt }
//
// The redirectUrl is suitable for SFSafariViewController on iOS or
// window.location.assign on web — it carries the token in the query
// string so the destination page can immediately consume it.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { mintToken } from '@/lib/authTokens';

const VALID_INTENTS = new Set(['upgrade', 'sign_in']);
const VALID_TIERS = new Set(['sonnet', 'opus', 'white_glove']);

export async function POST(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const intent: string = (body?.intent || 'upgrade').toString();
    const targetTier: string | undefined = body?.targetTier;

    if (!VALID_INTENTS.has(intent)) {
      return NextResponse.json({ error: `Invalid intent: ${intent}` }, { status: 400 });
    }
    if (intent === 'upgrade') {
      if (!targetTier || !VALID_TIERS.has(targetTier)) {
        return NextResponse.json({
          error: `Upgrade requires targetTier (one of: sonnet, opus, white_glove). Got: ${targetTier}`,
        }, { status: 400 });
      }
    }

    const minted = await mintToken({
      operatorId: auth.operatorId,
      type: 'web_handoff',
      intent,
      metadata: targetTier ? { targetTier } : {},
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get('host')}`;
    const path = intent === 'upgrade' ? '/upgrade' : '/welcome';
    const params = new URLSearchParams({ token: minted.token });
    if (targetTier) params.set('tier', targetTier);
    const redirectUrl = `${baseUrl}${path}?${params.toString()}`;

    return NextResponse.json({
      ok: true,
      token: minted.token,
      redirectUrl,
      expiresAt: minted.expiresAt.toISOString(),
      ttlSeconds: minted.ttlSeconds,
    });
  } catch (error) {
    console.error('[web-handoff-token] error', error);
    return NextResponse.json({
      error: 'Failed to mint token',
      details: String(error),
    }, { status: 500 });
  }
}
