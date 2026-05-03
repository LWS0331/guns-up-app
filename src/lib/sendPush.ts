// Web Push send-side helper. Phase 2C.
//
// Wraps the `web-push` library + the PushSubscription Prisma table.
// One entry point: sendPushToOperator(operatorId, payload) — looks up
// every active subscription for the operator, fans out the push, and
// cleans up endpoints the push service has revoked (404 / 410).
//
// VAPID keys come from env. To rotate / generate a new pair locally:
//   npx web-push generate-vapid-keys --json
// Set VAPID_PUBLIC_KEY (also expose as NEXT_PUBLIC_VAPID_PUBLIC_KEY
// for client-side subscribe), VAPID_PRIVATE_KEY, and
// VAPID_CONTACT_EMAIL (e.g. mailto:ruben@gunsupfit.com).
//
// In dev where VAPID isn't set, every send no-ops and logs to console.
// We never throw on push failure — a missed notification must NEVER
// break the calling code path (cron tick, plan generation, etc).

import webpush from 'web-push';
import { prisma } from '@/lib/db';

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const contact = process.env.VAPID_CONTACT_EMAIL || 'mailto:ops@gunsupfit.com';
  if (!pub || !priv) {
    return false;
  }
  webpush.setVapidDetails(contact, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  /** Notification title — short, ≤ ~40 chars to avoid OS truncation. */
  title: string;
  /** Body — 1–2 short sentences. */
  body: string;
  /** Optional URL the notification opens when tapped. Defaults to /plan. */
  url?: string;
  /** Optional tag for OS-level dedup (replaces previous notification with same tag). */
  tag?: string;
  /** Optional category — filtered against PushSubscription.mutedCategories. */
  category?: string;
  /** Optional silent flag (no sound / vibration; useful for low-priority blocks). */
  silent?: boolean;
}

interface SendResult {
  attempted: number;
  succeeded: number;
  prunedEndpoints: string[];
  errors: { endpoint: string; status?: number; message: string }[];
}

export async function sendPushToOperator(
  operatorId: string,
  payload: PushPayload,
): Promise<SendResult> {
  if (!ensureConfigured()) {
    // eslint-disable-next-line no-console
    console.warn('[push] VAPID not configured — skipping send for', operatorId);
    return { attempted: 0, succeeded: 0, prunedEndpoints: [], errors: [] };
  }

  const subs = await prisma.pushSubscription.findMany({
    where: { operatorId, notificationsOn: true },
  });
  if (subs.length === 0) {
    return { attempted: 0, succeeded: 0, prunedEndpoints: [], errors: [] };
  }

  // Filter out subs that have muted this category.
  const targets = payload.category
    ? subs.filter((s) => !s.mutedCategories.includes(payload.category!))
    : subs;

  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/plan',
    tag: payload.tag,
    silent: payload.silent ?? false,
  });

  const prunedEndpoints: string[] = [];
  const errors: SendResult['errors'] = [];
  let succeeded = 0;

  // Sequential send so we don't slam the push services with a big
  // burst — operators rarely have more than 2-3 subscriptions, so
  // the latency cost of awaiting each is negligible.
  for (const sub of targets) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
      );
      succeeded++;
      // Stamp lastSeenAt so we know the endpoint was alive.
      await prisma.pushSubscription
        .update({
          where: { endpoint: sub.endpoint },
          data: { lastSeenAt: new Date() },
        })
        .catch(() => {
          /* race with concurrent unsubscribe — ignore */
        });
    } catch (err) {
      const e = err as { statusCode?: number; body?: string; message?: string };
      const status = e?.statusCode;
      // 404 / 410 mean the subscription is gone (browser revoked).
      // Prune it so we stop trying.
      if (status === 404 || status === 410) {
        prunedEndpoints.push(sub.endpoint);
        await prisma.pushSubscription
          .delete({ where: { endpoint: sub.endpoint } })
          .catch(() => {
            /* already gone — ok */
          });
      } else {
        errors.push({
          endpoint: sub.endpoint,
          status,
          message: e?.message ?? 'unknown',
        });
      }
    }
  }

  return {
    attempted: targets.length,
    succeeded,
    prunedEndpoints,
    errors,
  };
}

/**
 * Convenience for fanout to many operators in one call. Used by the
 * notification-tick cron when multiple operators have a block starting
 * at the same minute.
 */
export async function sendPushToOperators(
  operatorIds: string[],
  payload: PushPayload,
): Promise<{ totalAttempted: number; totalSucceeded: number }> {
  let totalAttempted = 0;
  let totalSucceeded = 0;
  // Per-operator awaits so one slow push service doesn't block the cron.
  // Promise.all would be faster but harder to debug if a single send hangs.
  for (const id of operatorIds) {
    const r = await sendPushToOperator(id, payload);
    totalAttempted += r.attempted;
    totalSucceeded += r.succeeded;
  }
  return { totalAttempted, totalSucceeded };
}
