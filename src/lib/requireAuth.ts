import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';
import { AUTH_COOKIE_NAME } from './authCookie';

/**
 * Extract and verify JWT from Authorization header or cookie.
 * Returns the decoded token payload or a 401 NextResponse.
 *
 * Cookie name unified with src/lib/authCookie.ts (AUTH_COOKIE_NAME) so
 * the iOS-PWA-survival fix from Apr 2026 (httpOnly cookie alongside
 * localStorage JWT) works through this middleware too.
 */
export function requireAuth(req: NextRequest):
  | { operatorId: string; role: string }
  | NextResponse {
  // Check Authorization header first, then cookie
  const authHeader = req.headers.get('authorization');
  const token =
    authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  return decoded;
}
