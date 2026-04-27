// GET /api/cron/activation-emails
//
// PaywallSpec §9 cron — every 30 minutes Railway/Vercel calls this
// endpoint, which scans operators due for the next email in the
// 4-step activation cadence and queues sends.
//
// Cadence (per PaywallSpec §6):
//   - Email 1: webPurchaseAt + 0   (sent inline by Stripe webhook;
//                                     cron is a fallback)
//   - Email 2: webPurchaseAt + 6h  (only if app not opened)
//   - Email 3: webPurchaseAt + 3d  (only if first workout not done)
//   - Email 4: webPurchaseAt + 7d  (refund offer)
//
// Auth: protected by CRON_SECRET env var (Railway cron + Vercel cron
// both pass it as a Bearer token). Local dev hits it without secret.

import { NextRequest, NextResponse } from 'next/server';
import { runActivationEmailScheduler } from '@/lib/activationEmails';

export async function GET(req: NextRequest) {
  // Bearer auth via CRON_SECRET (matches Vercel + Railway cron conventions).
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const summary = await runActivationEmailScheduler();
    return NextResponse.json({ ok: true, ...summary, ts: new Date().toISOString() });
  } catch (error) {
    console.error('[cron/activation-emails] error', error);
    return NextResponse.json({
      error: 'Cron failed',
      details: String(error),
    }, { status: 500 });
  }
}
