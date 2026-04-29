import { NextResponse } from 'next/server';
import { clearAuthCookie } from '@/lib/authCookie';

// POST /api/auth/logout
// Clears the persistent httpOnly auth cookie. Client-side should also
// clear its localStorage authToken (page.tsx::handleLogout does that
// already). Without this server-side clear, the cookie would survive
// localStorage clears and silently re-authenticate the next visitor on
// a shared device — which is the OPPOSITE of what logout means.
export async function POST() {
  const res = NextResponse.json({ ok: true });
  clearAuthCookie(res);
  return res;
}
