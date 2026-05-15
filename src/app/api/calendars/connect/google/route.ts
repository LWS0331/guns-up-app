// GET /api/calendars/connect/google
//
// Phase 1 calendar integration entry point. Mints an HMAC-signed OAuth
// state (reusing the cookie-free state machinery from PR #129) carrying
// the operator id + post-connect destination, then 302s to Google's
// consent screen. The callback at /api/calendars/callback/google
// verifies the state, exchanges the code, and writes a CalendarConnection
// row with encrypted tokens.
//
// Auth: requireAuth() — the operator connects their OWN calendar. We
// don't allow admins to connect a calendar for another operator
// because Google's consent step has to happen in that operator's
// browser session. Future Stripe-recovery / impersonation flows can
// add an operatorId override behind a separate gate.
//
// Feature-flagged: returns 503 when GOOGLE_CALENDAR_OAUTH_ENABLED is
// off so the UI can surface "Coming soon" without crashing.

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/requireAuth';
import { isGoogleCalendarOauthEnabledServer } from '@/lib/featureFlags';
import {
  buildCalendarAuthorizeUrl,
  getGoogleCalendarConfig,
  signOauthState,
} from '@/lib/oauthGoogle';

function isSafeNext(value: string | null): boolean {
  if (!value) return false;
  return value.startsWith('/') && !value.startsWith('//');
}

export async function GET(req: NextRequest) {
  const auth = requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  if (!isGoogleCalendarOauthEnabledServer()) {
    return NextResponse.json(
      {
        error: 'Calendar integration not enabled.',
        code: 'feature_disabled',
      },
      { status: 503 },
    );
  }

  let config;
  try {
    config = getGoogleCalendarConfig();
  } catch (err) {
    console.error('[api/calendars/connect/google] config error:', err);
    return NextResponse.json(
      {
        error: 'Google Calendar OAuth is not configured.',
        code: 'not_configured',
      },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const nextParam = url.searchParams.get('next');
  // Default post-connect destination is the Daily Ops surface — the
  // operator just connected their calendar, so dropping them back
  // onto the surface that benefits is the right next step.
  const next = isSafeNext(nextParam) ? nextParam! : '/';

  // State carries the post-connect destination only. Operator identity
  // is recovered in the callback via requireAuth — the auth cookie
  // (httpOnly, sameSite=lax) travels with Google's top-level GET
  // redirect back to our origin, so the callback knows who's
  // connecting without trusting the URL.
  let state: string;
  try {
    state = signOauthState({ next });
  } catch (err) {
    console.error('[api/calendars/connect/google] state signing failed:', err);
    return NextResponse.json(
      { error: 'Auth signing key not configured.', code: 'state_unsigned' },
      { status: 500 },
    );
  }

  const authorizeUrl = buildCalendarAuthorizeUrl(config, state);
  return NextResponse.redirect(authorizeUrl, { status: 302 });
}
