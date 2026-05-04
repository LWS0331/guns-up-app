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

// Cookie-based state was retired Apr 2026 — see signOauthState /
// verifyOauthState below. iOS PWA cookie isolation between the OAuth
// redirect to Google and the callback was dropping the state cookie,
// producing a steady stream of `state_mismatch` rejections that
// looked to users like "Sign-in session expired" with no recovery
// path. The HMAC-signed self-validating state below carries its own
// proof through the round-trip, so no cookies are needed.
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

// ── HMAC-SIGNED OAUTH STATE (cookie-free) ──
//
// The state value sent through the OAuth dance is a self-validating
// signed token: base64url(JSON{nonce, ts, next}) + '.' + HMAC-SHA256(body).
// The callback re-derives the HMAC from the body and refuses any state
// whose signature doesn't match or whose timestamp is older than
// OAUTH_STATE_TTL_SEC. No cookie write/read is involved, so the iOS
// PWA cookie-isolation issue between Google's redirect and our
// callback can't drop the state.
//
// Replay window inside TTL is acceptable for closed-beta — the real
// CSRF defense is HTTPS plus the closed-beta allowlist; the state is
// belt-and-suspenders. If we ever need stricter single-use, drop in
// an in-memory used-nonce set keyed by `n` with a 10-min sweep.

interface OauthStatePayload {
  n: string;       // random nonce (entropy / dedupe handle)
  t: number;       // ms since epoch when minted
  next: string;    // post-login destination (whitelisted by /start)
}

function getStateSecret(): string {
  // Reuse the JWT secret — already required by the rest of the auth
  // surface, so OAuth state and JWT compromise/rotation move together.
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required for OAuth state signing.',
    );
  }
  return secret;
}

function hmacSig(body: string): string {
  // 22 chars of base64url ≈ 132 bits of MAC strength — comfortably
  // above the bar for a 10-minute-TTL CSRF token, while keeping the
  // total state value short enough to pass cleanly through Google's
  // 1024-byte state limit alongside the JSON payload.
  return crypto
    .createHmac('sha256', getStateSecret())
    .update(body)
    .digest('base64url')
    .slice(0, 22);
}

/**
 * Mint a signed OAuth state value. Pass the `next` destination so the
 * callback can resume to the right place without needing a sibling
 * cookie. The returned string is URL-safe (base64url + '.').
 */
export function signOauthState(opts: { next: string }): string {
  const payload: OauthStatePayload = {
    n: crypto.randomBytes(16).toString('base64url'),
    t: Date.now(),
    next: opts.next,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${hmacSig(body)}`;
}

export type OauthStateVerifyResult =
  | { ok: true; next: string; issuedAt: number; nonce: string }
  | { ok: false; reason: string };

/**
 * Verify a state value round-tripped through Google. Returns the
 * decoded payload on success, or a structured failure with a `reason`
 * tag suitable for telemetry. Callers should always treat any failure
 * as `state_mismatch` to the user.
 */
export function verifyOauthState(
  state: string | null | undefined,
): OauthStateVerifyResult {
  if (!state) return { ok: false, reason: 'missing' };
  const dot = state.lastIndexOf('.');
  if (dot < 1 || dot >= state.length - 1) {
    return { ok: false, reason: 'malformed' };
  }
  const body = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  let expected: string;
  try {
    expected = hmacSig(body);
  } catch {
    return { ok: false, reason: 'sign_failed' };
  }
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (
    sigBuf.length !== expBuf.length ||
    !crypto.timingSafeEqual(sigBuf, expBuf)
  ) {
    return { ok: false, reason: 'bad_signature' };
  }
  let payload: OauthStatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8'),
    ) as OauthStatePayload;
  } catch {
    return { ok: false, reason: 'bad_payload' };
  }
  if (
    typeof payload.t !== 'number' ||
    typeof payload.n !== 'string' ||
    typeof payload.next !== 'string'
  ) {
    return { ok: false, reason: 'bad_payload_shape' };
  }
  const ageMs = Date.now() - payload.t;
  if (ageMs < 0 || ageMs > OAUTH_STATE_TTL_SEC * 1000) {
    return { ok: false, reason: 'expired' };
  }
  return {
    ok: true,
    next: payload.next,
    issuedAt: payload.t,
    nonce: payload.n,
  };
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
