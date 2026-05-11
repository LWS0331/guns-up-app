// Google Calendar push notification channels — Phase 3 webhooks.
//
// Google's events.watch API lets us subscribe to push notifications on
// a calendar so we don't have to poll. When events change Google POSTs
// to a webhook URL we provide. The flow:
//
//   1. registerCalendarWatch(connection) — calls events.watch with a
//      random channelId + a random token (shared secret). Google
//      returns a resourceId and an expiration timestamp.
//   2. We persist { channelId, resourceId, token, expirationMs } onto
//      syncData.watch so the webhook receiver can validate inbound
//      pings and the cron can renew nearing-expiry channels.
//   3. The webhook receiver (/api/calendars/webhooks/google) reads
//      X-Goog-Channel-Id + X-Goog-Channel-Token, looks up the
//      matching connection, verifies the token, and triggers a sync.
//
// Limitations / gotchas:
//   - Channels max out at ~30 days. Must be renewed before expiry.
//     The calendar-sync cron handles renewal.
//   - The webhook URL must be HTTPS on a Google-verified domain
//     (Search Console domain ownership). Local dev can't run this.
//   - Disconnecting without stop()ing the channel leaves a "ghost"
//     subscription on Google's side; harmless but tidy to call
//     stopCalendarWatch on disconnect (added in /api/calendars
//     DELETE path).
//
// Feature flag: GOOGLE_CALENDAR_WEBHOOKS_ENABLED. With the flag off,
// register/stop are no-ops, the connect/callback route doesn't even
// try, and operators continue to depend on the cron-driven polling
// for freshness. Rollback: unset the env var.

import * as crypto from 'crypto';
import type { CalendarConnection, Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { decryptToken } from '@/lib/calendarTokens';

export interface CalendarWatchState {
  channelId: string;
  resourceId: string;
  /** Secret echoed back as X-Goog-Channel-Token. */
  token: string;
  /** Unix ms when the channel will be terminated by Google. */
  expirationMs: number;
  /** Webhook URL used at registration time — for diagnostics. */
  address: string;
  /** When we registered this channel. */
  registeredAtMs: number;
}

export function isWebhooksEnabled(): boolean {
  return process.env.GOOGLE_CALENDAR_WEBHOOKS_ENABLED === 'true';
}

/** Webhook URL we'll register with Google. Null when APP_URL isn't set. */
export function webhookAddress(): string | null {
  const base = process.env.NEXT_PUBLIC_APP_URL || process.env.HOST_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/api/calendars/webhooks/google`;
}

/** Read the persisted watch state off the connection, if any. */
export function readWatchState(conn: CalendarConnection): CalendarWatchState | null {
  const sync = (conn.syncData as Record<string, unknown> | null) || {};
  const watch = sync.watch;
  if (!watch || typeof watch !== 'object') return null;
  const w = watch as Record<string, unknown>;
  const channelId = typeof w.channelId === 'string' ? w.channelId : null;
  const resourceId = typeof w.resourceId === 'string' ? w.resourceId : null;
  const token = typeof w.token === 'string' ? w.token : null;
  const expirationMs = typeof w.expirationMs === 'number' ? w.expirationMs : null;
  const address = typeof w.address === 'string' ? w.address : '';
  const registeredAtMs = typeof w.registeredAtMs === 'number' ? w.registeredAtMs : 0;
  if (!channelId || !resourceId || !token || !expirationMs) return null;
  return { channelId, resourceId, token, expirationMs, address, registeredAtMs };
}

async function writeWatchState(
  conn: CalendarConnection,
  next: CalendarWatchState | null,
): Promise<void> {
  const sync = (conn.syncData as Record<string, unknown> | null) || {};
  const updated = { ...sync };
  if (next) {
    updated.watch = next as unknown as Prisma.JsonValue;
  } else {
    delete updated.watch;
  }
  await prisma.calendarConnection.update({
    where: { id: conn.id },
    data: {
      syncData: updated as unknown as Parameters<typeof prisma.calendarConnection.update>[0]['data']['syncData'],
    },
  });
}

/**
 * Subscribe to push notifications on this connection's calendar.
 * No-op (returns null) when webhooks are flag-disabled or APP_URL is
 * not configured. On Google API failure returns { error }.
 */
export async function registerCalendarWatch(
  conn: CalendarConnection,
): Promise<{ ok: true; state: CalendarWatchState } | { ok: false; error: string } | null> {
  if (!isWebhooksEnabled()) return null;
  if (conn.provider !== 'google') return null;
  const address = webhookAddress();
  if (!address) return { ok: false, error: 'APP_URL not configured' };

  const accessToken = decryptToken(conn.accessTokenEnc ?? '');
  if (!accessToken) {
    return { ok: false, error: 'Access token unavailable; sync first.' };
  }

  const channelId = crypto.randomUUID();
  const token = crypto.randomBytes(24).toString('base64url');
  // Google caps watches at 30 days; we ask for the max and let
  // Google clamp. The cron renews before expiry.
  const requestedTtlMs = 30 * 24 * 60 * 60 * 1000;
  const expirationMs = Date.now() + requestedTtlMs;

  const url = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(conn.externalCalId)}/events/watch`,
  );

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: channelId,
        type: 'web_hook',
        address,
        token,
        expiration: String(expirationMs),
      }),
    });
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'fetch error' };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return { ok: false, error: `HTTP ${res.status}: ${detail.slice(0, 200)}` };
  }
  const data = (await res.json()) as { resourceId?: string; expiration?: string };
  if (!data.resourceId) {
    return { ok: false, error: 'Google response missing resourceId.' };
  }
  const grantedExpirationMs = data.expiration
    ? Number(data.expiration)
    : expirationMs;
  const state: CalendarWatchState = {
    channelId,
    resourceId: data.resourceId,
    token,
    expirationMs: grantedExpirationMs,
    address,
    registeredAtMs: Date.now(),
  };
  await writeWatchState(conn, state);
  return { ok: true, state };
}

/**
 * Tear down a registered channel. Best-effort — Google's stop
 * endpoint can 404 on already-expired channels, which we treat as
 * success.
 */
export async function stopCalendarWatch(conn: CalendarConnection): Promise<void> {
  if (conn.provider !== 'google') return;
  const watch = readWatchState(conn);
  if (!watch) return;

  const accessToken = decryptToken(conn.accessTokenEnc ?? '');
  if (!accessToken) {
    // Best-effort: clear our local state even if we can't reach Google.
    await writeWatchState(conn, null);
    return;
  }

  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/channels/stop', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: watch.channelId,
        resourceId: watch.resourceId,
      }),
    });
    if (!res.ok && res.status !== 404) {
      const detail = await res.text().catch(() => '');
      console.warn('[calendarWatch] stop returned', res.status, detail.slice(0, 200));
    }
  } catch (err) {
    console.warn('[calendarWatch] stop failed:', err);
  }
  await writeWatchState(conn, null);
}

/**
 * Renew any watch within 7 days of expiry. Called from
 * /api/cron/calendar-sync. Returns per-connection outcomes for
 * diagnostics.
 */
export async function renewExpiringWatches(): Promise<{
  scanned: number;
  renewed: number;
  failed: number;
}> {
  if (!isWebhooksEnabled()) return { scanned: 0, renewed: 0, failed: 0 };
  const RENEW_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() + RENEW_THRESHOLD_MS;
  // We can't query JSON syncData fields directly via Prisma for all
  // providers — small dataset for now, so a scan + in-memory filter
  // is acceptable. Revisit if connection counts > ~10k.
  const connections = await prisma.calendarConnection.findMany({
    where: { provider: 'google', active: true },
  });
  let renewed = 0;
  let failed = 0;
  for (const conn of connections) {
    const state = readWatchState(conn);
    if (!state) continue;
    if (state.expirationMs > cutoff) continue;
    // Tear the old channel down first so we don't accumulate ghosts,
    // then register a fresh one.
    await stopCalendarWatch(conn);
    const fresh = await prisma.calendarConnection.findUnique({ where: { id: conn.id } });
    if (!fresh) {
      failed++;
      continue;
    }
    const result = await registerCalendarWatch(fresh);
    if (result && result.ok) renewed++;
    else failed++;
  }
  return { scanned: connections.length, renewed, failed };
}
