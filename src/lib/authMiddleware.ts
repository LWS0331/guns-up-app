import { NextRequest } from 'next/server';
import { verifyToken } from './auth';
import { readAuthCookie } from './authCookie';

/**
 * Resolve the calling operator from a request. Tries the Authorization
 * header first (preferred — explicit API calls from the SPA), falls back
 * to the auth cookie (used when localStorage was wiped but the cookie
 * survived, e.g. iOS PWA relaunch).
 *
 * Returns null when no valid token is present in either place.
 */
export function getAuthOperator(request: NextRequest): { operatorId: string; role: string } | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const headerToken = authHeader.slice(7);
    const verified = verifyToken(headerToken);
    if (verified) return verified;
    // Header was present but invalid (expired/malformed). Don't silently
    // fall through to cookie — that would let a stale-header attempt
    // succeed via cookie auth, which is confusing. Return null and let
    // the caller decide.
    return null;
  }

  // No header → try cookie. This is the path that fires on app boot
  // when localStorage is empty but the user still has an active
  // session via the httpOnly cookie set at login time.
  const cookieToken = readAuthCookie(request);
  if (cookieToken) {
    return verifyToken(cookieToken);
  }
  return null;
}
