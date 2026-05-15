import { NextRequest, NextResponse } from 'next/server';
import {
  buildAuthorizeUrl,
  getGoogleConfig,
  signOauthState,
} from '@/lib/oauthGoogle';

// GET /api/auth/google/start
//
// Kicks off the OAuth dance. Generates an HMAC-signed state value
// embedding the post-login destination, then redirects to Google's
// consent screen with that state. The callback re-derives the HMAC
// to verify the state — no cookies involved.
//
// Apr 2026: Migrated from cookie-paired state to self-validating
// signed state because iOS PWA was dropping the state cookie between
// the redirect to Google and the callback, producing a steady stream
// of "Sign-in session expired" errors. See lib/oauthGoogle.ts.
//
// Optional query params:
//   ?next=/foo  — post-login destination embedded in the signed state.
//                 Whitelisted to internal paths to prevent open-redirect.
//   ?tier=opus  — pass-through so the post-OAuth flow can resume Stripe
//                 checkout (handled at /auth/oauth-callback).

function isSafeNext(value: string | null): boolean {
  if (!value) return false;
  // Internal-only: must start with `/` and not `//` (which is protocol-relative)
  return value.startsWith('/') && !value.startsWith('//');
}

export async function GET(req: NextRequest) {
  let config;
  try {
    config = getGoogleConfig();
  } catch (err) {
    console.error('[api/auth/google/start] config error:', err);
    return NextResponse.json(
      { error: 'Google sign-in is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXT_PUBLIC_APP_URL.' },
      { status: 500 },
    );
  }

  const url = new URL(req.url);
  const nextParam = url.searchParams.get('next');
  const tierParam = url.searchParams.get('tier');
  const cycleParam = url.searchParams.get('cycle');

  // Build the post-OAuth destination. If a `tier` was passed in, default the
  // next param to the existing /login?tier=...&cycle= flow so checkout
  // resumes after auth. Caller can override via ?next=.
  let next = isSafeNext(nextParam) ? nextParam! : '/';
  if (!nextParam && tierParam) {
    const cycle = cycleParam === 'annual' ? 'annual' : 'monthly';
    next = `/login?tier=${encodeURIComponent(tierParam)}&cycle=${cycle}`;
  }

  let state: string;
  try {
    state = signOauthState({ next });
  } catch (err) {
    // Missing JWT_SECRET — surface as a config error rather than
    // silently building a state that will fail verification later.
    console.error('[api/auth/google/start] state signing failed:', err);
    return NextResponse.json(
      { error: 'Auth signing key not configured.' },
      { status: 500 },
    );
  }

  const authorizeUrl = buildAuthorizeUrl(config, state);
  return NextResponse.redirect(authorizeUrl, { status: 302 });
}
