// Google OAuth 2.0 helpers — server-side only.
//
// Phase 1 of the Gmail/iCloud login migration. We don't use NextAuth.js here
// because the rest of the app already issues a custom JWT via lib/auth.ts;
// bringing in NextAuth would split the auth surface. Manual OAuth keeps the
// existing Authorization: Bearer <jwt> flow intact — Google just becomes a
// new way to *get* that JWT.
//
// Apple Sign In (Phase 2) will live in a sibling module (lib/oauthApple.ts)
// with the same shape but a different token-exchange + JWT-verify story.
//
// Required env vars (none of these have defaults — fail-fast at the call
// site if any are missing):
//   GOOGLE_CLIENT_ID
//   GOOGLE_CLIENT_SECRET
//   NEXT_PUBLIC_APP_URL  (or HOST_URL) — used to build the redirect_uri

import * as crypto from 'crypto';

const GOOGLE_AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Cookie name carrying the signed CSRF state. httpOnly + sameSite=lax so it
// survives the Google redirect back to us. Short TTL (10 min) — OAuth dance
// shouldn't take longer than that.
export const OAUTH_STATE_COOKIE = 'gunsup_oauth_state';
export const OAUTH_STATE_TTL_SEC = 600;

export interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function getGoogleConfig(): GoogleConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required. Provision in Google Cloud Console → OAuth client (web), set authorized redirect URI to ${APP_URL}/api/auth/google/callback.',
    );
  }
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.HOST_URL;
  if (!baseUrl) {
    throw new Error(
      'NEXT_PUBLIC_APP_URL (or HOST_URL) is required so we can build the OAuth redirect_uri.',
    );
  }
  const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/auth/google/callback`;
  return { clientId, clientSecret, redirectUri };
}

/** Build the Google authorize URL the browser should be redirected to. */
export function buildAuthorizeUrl(config: GoogleConfig, state: string, nextPath?: string): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  // Stash the post-login destination inside the state-bound cookie, not the
  // URL — but if a caller wants to embed it in `state` they can append.
  if (nextPath) params.set('login_hint', '');
  return `${GOOGLE_AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Generate a state token for CSRF protection. Returns the raw nonce — the
 * caller stores the same nonce in an httpOnly cookie and embeds it in the
 * OAuth `state` parameter. On callback we compare the cookie to the state
 * round-tripped through Google.
 */
export function generateStateNonce(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/** Constant-time comparison so timing attacks can't leak partial matches. */
export function compareStateNonce(a: string, b: string): boolean {
  if (!a || !b) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export interface GoogleTokenResponse {
  access_token: string;
  expires_in: number;
  id_token: string;
  scope: string;
  token_type: 'Bearer';
}

/** Exchange the authorization code for tokens. */
export async function exchangeCodeForTokens(
  config: GoogleConfig,
  code: string,
): Promise<GoogleTokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as GoogleTokenResponse;
}

export interface GoogleIdTokenClaims {
  sub: string;            // stable per-user Google ID — store as Operator.googleId
  email: string;
  email_verified: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
}

/**
 * Decode the id_token without signature verification.
 *
 * SAFETY NOTE: We received this token directly from Google over TLS in the
 * code-exchange response, so an attacker would have had to break TLS to
 * inject a forged token. For Phase 1 this trust model is acceptable. Phase 2
 * should verify against Google's JWKS (https://www.googleapis.com/oauth2/v3/certs)
 * — meaningful only if we ever accept an id_token submitted by the client
 * directly (e.g. mobile native sign-in), which we don't yet.
 */
export function decodeIdToken(idToken: string): GoogleIdTokenClaims {
  const parts = idToken.split('.');
  if (parts.length !== 3) throw new Error('Malformed id_token');
  const payloadJson = Buffer.from(parts[1], 'base64url').toString('utf8');
  const payload = JSON.parse(payloadJson) as GoogleIdTokenClaims;
  if (!payload.sub || !payload.email) {
    throw new Error('id_token missing required claims (sub, email)');
  }
  return payload;
}

/**
 * Derive a default callsign from a Google profile. Real users can change it
 * later via Intel Center; we just need something non-empty + unique-ish at
 * provisioning time. Pattern: uppercase first 12 chars of given_name (or
 * email local-part) + "-" + 4 random base32 chars.
 */
export function deriveCallsign(claims: GoogleIdTokenClaims): string {
  const seed =
    (claims.given_name || claims.email.split('@')[0] || 'OPERATOR')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase()
      .slice(0, 12) || 'OPERATOR';
  const suffix = crypto.randomBytes(3).toString('base64url').replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 4) || 'X';
  return `${seed}-${suffix}`;
}
