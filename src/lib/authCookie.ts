// Auth cookie helper.
//
// Beta users on iOS PWA reported that closing + reopening the app forces
// re-login + wipes Gunny chat history. Root cause: localStorage on iOS is
// volatile across app-relaunch in some scenarios (storage pressure, ITP,
// PWA-specific quirks). The JWT was stored ONLY in localStorage; when it
// disappeared, the user fell back to the login screen, and the chat
// history (server-side, but only restorable AFTER auth) couldn't load.
//
// Fix: issue the same JWT as an httpOnly cookie alongside the localStorage
// path. Cookies survive iOS PWA relaunches far more reliably. The
// localStorage entry stays as a fast in-tab signal; the cookie is the
// canonical persistence layer.
//
// requireAuth + getAuthOperator both read EITHER the Authorization header
// (preferred for explicit API calls) OR the cookie (used on app boot
// when localStorage is empty but the user is still a valid session).

import type { NextRequest, NextResponse } from 'next/server';

/** Cookie name. Prefixed `__Host-` would be ideal for additional safety
 *  but it requires `Secure` + no `Domain` attribute, which breaks
 *  localhost dev. Plain name with secure-when-prod attributes below. */
export const AUTH_COOKIE_NAME = 'gunsup_auth';

/** TTL matches the JWT expiry in lib/auth.ts (TOKEN_EXPIRY = '7d'). */
const AUTH_COOKIE_MAX_AGE_SEC = 7 * 24 * 60 * 60;

/**
 * Set the auth cookie on a NextResponse. Call from any route that issues
 * a fresh JWT — login, register, google callback, etc.
 *
 * httpOnly so JS can't read it (defense against XSS exfiltration of the
 * token). sameSite=lax so the cookie travels with normal navigations
 * (including the OAuth redirect-back). secure in production.
 */
export function setAuthCookie(res: NextResponse, token: string): void {
  res.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_SEC,
  });
}

/** Clear the auth cookie. Used on logout. */
export function clearAuthCookie(res: NextResponse): void {
  res.cookies.set(AUTH_COOKIE_NAME, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
}

/** Read the cookie value from a request. Returns null when absent. */
export function readAuthCookie(req: NextRequest): string | null {
  const v = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  return v || null;
}
