import { NextRequest, NextResponse } from 'next/server';
import {
  buildAuthorizeUrl,
  generateStateNonce,
  getGoogleConfig,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SEC,
} from '@/lib/oauthGoogle';

// GET /api/auth/google/start
//
// Kicks off the OAuth dance. Generates a CSRF state nonce, sets it as an
// httpOnly cookie, and redirects to Google's consent screen carrying the
// same nonce in the OAuth `state` param. The callback compares the two.
//
// Optional query params:
//   ?next=/foo  — post-login destination, stored in a sibling cookie.
//                 Whitelisted to internal paths to prevent open-redirect.
//   ?tier=opus  — pass-through so the post-OAuth flow can resume Stripe
//                 checkout (handled at /auth/oauth-callback).

const NEXT_COOKIE = 'gunsup_oauth_next';

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

  const state = generateStateNonce();
  const authorizeUrl = buildAuthorizeUrl(config, state);

  const res = NextResponse.redirect(authorizeUrl, { status: 302 });
  // httpOnly + sameSite=lax: lax is required because the callback arrives via
  // a top-level GET redirect from accounts.google.com, where strict cookies
  // would not be sent.
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: OAUTH_STATE_TTL_SEC,
  });
  res.cookies.set(NEXT_COOKIE, next, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: OAUTH_STATE_TTL_SEC,
  });
  return res;
}
