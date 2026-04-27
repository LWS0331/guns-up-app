import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { generateToken } from '@/lib/auth';
import { isOperatorAllowed } from '@/lib/allowlist';
import {
  compareStateNonce,
  decodeIdToken,
  exchangeCodeForTokens,
  getGoogleConfig,
  OAUTH_STATE_COOKIE,
} from '@/lib/oauthGoogle';

// GET /api/auth/google/callback
//
// Final leg of the OAuth dance. Verifies the CSRF state, exchanges the code
// for tokens, looks up the Operator, mints the existing-shape JWT (so the
// rest of the app's Authorization: Bearer flow works unchanged), then
// redirects to /auth/oauth-callback?token=... where a tiny client page
// stores the token in localStorage and continues to the post-login destination.
//
// CLOSED BETA POLICY (April 2026): we DO NOT auto-create operators from
// Google sign-ins. Closed-beta operators are pre-seeded; the founder
// admin assigns their email via /api/admin/set-emails, and that email
// IS the allowlist membership. Google sign-in succeeds only when:
//   1. An Operator exists with this googleId already (returning OAuth user), OR
//   2. An Operator exists with this email AND `isOperatorAllowed` (admin
//      pre-assigned the email) — we link the googleId to that operator.
// If neither match → reject with `not_authorized` so the user gets a
// clean "contact Ruben" message instead of a half-created shell account.

const NEXT_COOKIE = 'gunsup_oauth_next';

function safeNext(value: string | null | undefined): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

function failureRedirect(req: NextRequest, reason: string): NextResponse {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${new URL(req.url).origin}`;
  const target = new URL('/login', baseUrl);
  target.searchParams.set('oauth_error', reason);
  const res = NextResponse.redirect(target, { status: 302 });
  // Clear the dance cookies — they're single-use.
  res.cookies.delete(OAUTH_STATE_COOKIE);
  res.cookies.delete(NEXT_COOKIE);
  return res;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateFromGoogle = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    console.warn('[api/auth/google/callback] Google returned error:', error);
    return failureRedirect(req, error);
  }
  if (!code || !stateFromGoogle) {
    return failureRedirect(req, 'missing_code_or_state');
  }

  // Verify CSRF state against the cookie set by /start
  const stateFromCookie = req.cookies.get(OAUTH_STATE_COOKIE)?.value;
  if (!stateFromCookie || !compareStateNonce(stateFromCookie, stateFromGoogle)) {
    console.warn('[api/auth/google/callback] state mismatch');
    return failureRedirect(req, 'state_mismatch');
  }

  // Pull the post-login destination set at /start. Defaults to "/".
  const next = safeNext(req.cookies.get(NEXT_COOKIE)?.value);

  let config;
  try {
    config = getGoogleConfig();
  } catch (err) {
    console.error('[api/auth/google/callback] config error:', err);
    return failureRedirect(req, 'not_configured');
  }

  // Exchange code → tokens → claims
  let tokens;
  let claims;
  try {
    tokens = await exchangeCodeForTokens(config, code);
    claims = decodeIdToken(tokens.id_token);
  } catch (err) {
    console.error('[api/auth/google/callback] token exchange failed:', err);
    return failureRedirect(req, 'token_exchange_failed');
  }

  if (!claims.email_verified) {
    return failureRedirect(req, 'email_not_verified');
  }

  const email = claims.email.toLowerCase().trim();
  const googleId = claims.sub;

  // Operator resolution — try googleId first, then email-match.
  // Closed-beta policy: we never CREATE a new operator from Google.
  // Pre-seeded operators only.
  let operator = await prisma.operator.findUnique({ where: { googleId } });

  if (!operator && email) {
    // Existing operator with email assigned signs in with Google for the
    // first time. Link the accounts so future sign-ins resolve via
    // googleId directly. Note: findFirst (not findUnique) because email
    // may be NULL for some seeded operators that haven't been activated.
    const byEmail = await prisma.operator.findFirst({ where: { email } });
    if (byEmail && isOperatorAllowed(byEmail)) {
      operator = await prisma.operator.update({
        where: { id: byEmail.id },
        data: { googleId },
      });
    }
  }

  // Final allowlist verdict. If no operator matched (or matched but the
  // email got nulled to revoke), reject. Same `not_authorized` reason
  // so the /login page surfaces the standard "Contact Ruben" message.
  if (!operator || !isOperatorAllowed(operator)) {
    console.warn('[api/auth/google/callback] rejected unauthorized Google sign-in:', email);
    return failureRedirect(req, 'not_authorized');
  }

  // Mint the existing-shape JWT so the rest of the auth surface works
  // unchanged. Token travels via the URL exactly once; the callback page
  // immediately stashes it in localStorage and strips it from the address bar.
  let token: string;
  try {
    token = generateToken(operator.id, operator.role);
  } catch (err) {
    console.error('[api/auth/google/callback] token generation failed:', err);
    return failureRedirect(req, 'token_generation_failed');
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${new URL(req.url).origin}`;
  const dest = new URL('/auth/oauth-callback', baseUrl);
  dest.searchParams.set('token', token);
  dest.searchParams.set('next', next);

  const res = NextResponse.redirect(dest, { status: 302 });
  res.cookies.delete(OAUTH_STATE_COOKIE);
  res.cookies.delete(NEXT_COOKIE);
  return res;
}
