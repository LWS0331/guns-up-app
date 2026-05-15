// GET /api/calendars/callback/google
//
// Final leg of the calendar OAuth dance. Verifies the HMAC-signed
// state (cookie-free, mirrors the sign-in flow from PR #129),
// exchanges the code for tokens, encrypts them with calendarTokens,
// upserts a CalendarConnection row, and redirects to the post-
// connect destination.
//
// Operator identity comes from requireAuth() — the auth cookie set
// at sign-in time travels with Google's top-level GET redirect back
// to our origin (sameSite=lax). If the cookie expired between
// /connect and /callback the operator gets a 401 and has to sign
// in again before retrying — acceptable for v1.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAuth } from '@/lib/requireAuth';
import { isGoogleCalendarOauthEnabledServer } from '@/lib/featureFlags';
import {
  decodeIdToken,
  exchangeCodeForTokens,
  getGoogleCalendarConfig,
  GOOGLE_CALENDAR_SCOPE_STRING,
  verifyOauthState,
} from '@/lib/oauthGoogle';
import { encryptToken } from '@/lib/calendarTokens';

function failureRedirect(req: NextRequest, reason: string): NextResponse {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${new URL(req.url).origin}`;
  // Drop the operator on the home page with a calendar_error query
  // param so the CalendarConnect surface can render a structured
  // failure message.
  const target = new URL('/', baseUrl);
  target.searchParams.set('calendar_error', reason);
  return NextResponse.redirect(target, { status: 302 });
}

function safeNext(value: string | null | undefined): string {
  if (!value) return '/';
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export async function GET(req: NextRequest) {
  if (!isGoogleCalendarOauthEnabledServer()) {
    return failureRedirect(req, 'feature_disabled');
  }

  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return failureRedirect(req, 'unauthorized');

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const stateFromGoogle = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) {
    console.warn('[api/calendars/callback/google] Google returned error:', errorParam);
    return failureRedirect(req, errorParam);
  }
  if (!code || !stateFromGoogle) {
    return failureRedirect(req, 'missing_code_or_state');
  }

  const verified = verifyOauthState(stateFromGoogle);
  if (verified.ok !== true) {
    console.warn('[api/calendars/callback/google] state verify failed:', verified.reason);
    return failureRedirect(req, 'state_mismatch');
  }
  const next = safeNext(verified.next);

  let config;
  try {
    config = getGoogleCalendarConfig();
  } catch (err) {
    console.error('[api/calendars/callback/google] config error:', err);
    return failureRedirect(req, 'not_configured');
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(config, code);
  } catch (err) {
    console.error('[api/calendars/callback/google] token exchange failed:', err);
    return failureRedirect(req, 'token_exchange_failed');
  }

  // Pull the Google account email from the id_token claims so we can
  // surface "connected as foo@gmail.com" in the UI. id_token is
  // present because the calendar scope set includes "openid email".
  let providerAccountId: string | null = null;
  if (tokens.id_token) {
    try {
      const claims = decodeIdToken(tokens.id_token);
      providerAccountId = claims.email_verified ? claims.email.toLowerCase().trim() : null;
    } catch (err) {
      console.warn('[api/calendars/callback/google] id_token decode failed:', err);
    }
  }

  // Encrypt and persist. encryptToken throws if JWT_SECRET is missing —
  // that's a config error worth failing the whole connect over rather
  // than silently writing plaintext.
  let accessTokenEnc: string;
  let refreshTokenEnc: string | null = null;
  try {
    accessTokenEnc = encryptToken(tokens.access_token);
    if (tokens.refresh_token) {
      refreshTokenEnc = encryptToken(tokens.refresh_token);
    }
  } catch (err) {
    console.error('[api/calendars/callback/google] token encryption failed:', err);
    return failureRedirect(req, 'token_encryption_failed');
  }

  // Google returns expires_in (seconds). Convert to a real timestamp
  // so the sync route can do "if (now > tokenExpiresAt) refresh".
  const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

  try {
    await prisma.calendarConnection.upsert({
      where: {
        operatorId_provider: {
          operatorId: auth.operatorId,
          provider: 'google',
        },
      },
      update: {
        providerAccountId,
        accessTokenEnc,
        // Only update refreshTokenEnc when Google actually returned one
        // — re-authorize with prompt=consent SHOULD always include it,
        // but if Google ever changes the contract we don't want to wipe
        // a still-valid refresh token by writing null.
        ...(refreshTokenEnc ? { refreshTokenEnc } : {}),
        tokenExpiresAt,
        scopes: GOOGLE_CALENDAR_SCOPE_STRING,
        active: true,
        lastSyncAt: null,  // force a sync on next /api/calendars/sync
      },
      create: {
        operatorId: auth.operatorId,
        provider: 'google',
        providerAccountId,
        externalCalId: 'primary',
        accessTokenEnc,
        refreshTokenEnc,
        tokenExpiresAt,
        scopes: GOOGLE_CALENDAR_SCOPE_STRING,
        active: true,
      },
    });
  } catch (err) {
    console.error('[api/calendars/callback/google] DB upsert failed:', err);
    return failureRedirect(req, 'persist_failed');
  }

  // Successful connect — bounce to the post-connect destination with
  // a small ?calendar_connected=google flag the UI can pick up to
  // show a success toast.
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${new URL(req.url).origin}`;
  const dest = new URL(next, baseUrl);
  dest.searchParams.set('calendar_connected', 'google');
  return NextResponse.redirect(dest, { status: 302 });
}
