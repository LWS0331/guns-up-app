import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from './auth';

/**
 * Extract and verify JWT from Authorization header or cookie.
 * Returns the decoded token payload or a 401 NextResponse.
 */
export function requireAuth(req: NextRequest):
  | { operatorId: string; role: string }
  | NextResponse {
  // Check Authorization header first, then cookie
  const authHeader = req.headers.get('authorization');
  const token =
    authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : req.cookies.get('token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  return decoded;
}
