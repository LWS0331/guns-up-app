// Shared auth gate for cron route handlers.
//
// PROBLEM (caught in v1 audit, April 2026): the original cron auth
// pattern was:
//
//   const cronSecret = process.env.CRON_SECRET;
//   if (cronSecret) { /* check Bearer */ }
//
// That's fail-OPEN: when CRON_SECRET isn't set in the env (which was
// the production state at the time of the audit), the entire auth
// gate is skipped and the cron handler runs for any anonymous caller.
// Anyone on the internet could trigger /api/cron/baselines,
// /api/cron/activation-emails, or /api/cron/auth-token-cleanup at
// will. Cheap to mitigate but expensive at scale.
//
// FIX: this helper fails CLOSED in production. If CRON_SECRET isn't
// configured OR the request's Bearer doesn't match, return a NextResponse
// that the caller short-circuits on. Local dev (NODE_ENV !== 'production')
// is permissive so test runs don't need the env var.
//
// Usage in a cron route handler:
//   const denied = requireCronAuth(req);
//   if (denied) return denied;

import { NextRequest, NextResponse } from 'next/server';

/**
 * Returns null when the request is authorized to run cron work.
 * Returns a NextResponse (401 or 500) when not — caller should
 * short-circuit and return that response immediately.
 */
export function requireCronAuth(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  // Production with no secret = misconfigured deploy. Fail closed.
  // (Pre-fix behavior was fail-open — anyone could fire the cron.)
  if (!cronSecret) {
    if (isProd) {
      return NextResponse.json(
        { error: 'CRON_SECRET not configured on this deployment' },
        { status: 500 },
      );
    }
    // Local dev — allow without auth so developers can hit cron endpoints.
    return null;
  }

  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
