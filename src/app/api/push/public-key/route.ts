// /api/push/public-key — return the VAPID public key for client-side
// subscribe. Phase 2C.
//
// The browser's pushManager.subscribe() needs the VAPID public key as
// a urlBase64-encoded Uint8Array. We could expose this via
// NEXT_PUBLIC_VAPID_PUBLIC_KEY at build time, but that bakes it into
// the static bundle and makes rotation a redeploy. Serving it via
// this endpoint lets us rotate keys with a single env var update + a
// service-worker cache bump.
//
// Safe to expose publicly — the public half of a keypair is, by
// definition, public.

import { NextResponse } from 'next/server';

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return NextResponse.json(
      { ok: false, error: 'VAPID_PUBLIC_KEY not configured' },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, publicKey: key });
}
