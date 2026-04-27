// GET /api/cron/auth-token-cleanup
//
// PaywallSpec §9 — daily cleanup of expired AuthToken rows. Runs once
// a day; deletes tokens whose expiresAt is more than 7 days in the
// past. Not security-critical (verifyToken rejects expired tokens
// regardless) — purely DB hygiene.

import { NextRequest, NextResponse } from 'next/server';
import { cleanupExpiredTokens } from '@/lib/authTokens';

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  try {
    const deleted = await cleanupExpiredTokens(7);
    return NextResponse.json({ ok: true, deleted, ts: new Date().toISOString() });
  } catch (error) {
    console.error('[cron/auth-token-cleanup] error', error);
    return NextResponse.json({ error: 'Cleanup failed', details: String(error) }, { status: 500 });
  }
}
