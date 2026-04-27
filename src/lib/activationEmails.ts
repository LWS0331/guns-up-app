// Activation email queue + scheduler.
//
// PaywallSpec §6 defines four activation emails:
//   1. Immediate (within 60s of Stripe checkout)
//   2. 6 hours later (only if app not opened)
//   3. Day 3 (only if first workout not completed)
//   4. Day 7 (refund offer if user still hasn't activated)
//
// Plus three transactional emails (not on the four-email cadence):
//   - magic_link        — sent on /api/auth/magic-link request
//   - password_reset    — sent on recovery wizard request
//   - tier_upgraded     — sent on Stripe webhook tier change
//
// Architecture: this module exposes a `queueActivationEmail` writer
// that records the intent in a DB table OR writes to console (for
// the dev/no-provider phase). When a real email provider is wired
// (Resend/Postmark/etc.), the `dispatch` function below becomes a
// real send. Until then the queue is a logical/audit trail with the
// hot path stubbed. The cron at /api/cron/activation-emails calls
// `runActivationEmailScheduler` to fire the time-gated 4-email
// cadence per PaywallSpec §9.
//
// Why no separate queue table for now: `Operator.activationEmailsSent`
// + `lastActivationEmailAt` already give us the cadence cursor. Adding
// a queue table would be the right move once we have a real email
// provider with deliverability tracking — at that point each send
// becomes an EmailJob row with status. For now keep it lean.

import { prisma } from '@/lib/db';
import { mintToken } from '@/lib/authTokens';
import type { OperatorModel as Operator } from '@/generated/prisma/models/Operator';

export type ActivationEmailKind =
  | 'activation_1'           // immediate post-purchase
  | 'activation_2'           // 6h reminder
  | 'activation_3'           // 3d reminder
  | 'activation_4'           // 7d refund offer
  | 'magic_link'             // standalone magic-link request
  | 'password_reset'
  | 'tier_upgraded';

interface QueueEmailInput {
  operatorId: string;
  kind: ActivationEmailKind;
  email: string;
  magicToken?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Queue an activation email for delivery. In the no-provider phase
 * this writes to console + bumps the audit fields on Operator.
 *
 * Provider wiring (Resend/Postmark/SendGrid) is DEFERRED to its own
 * follow-up — when it lands, the implementation here becomes a real
 * send while keeping the same callsite contract.
 */
export async function queueActivationEmail(input: QueueEmailInput): Promise<{ ok: boolean; sent: boolean }> {
  const subject = SUBJECT_FOR_KIND[input.kind] || 'GUNS UP';
  const dispatched = await dispatch({
    to: input.email,
    subject,
    operatorId: input.operatorId,
    kind: input.kind,
    magicToken: input.magicToken,
    metadata: input.metadata || {},
  });

  // For the four-email cadence, advance the cursor so the cron
  // doesn't re-send. Magic-link / password-reset / tier-upgraded
  // are transactional and don't move the cursor.
  if (CADENCE_KINDS.has(input.kind)) {
    await prisma.operator.update({
      where: { id: input.operatorId },
      data: {
        activationEmailsSent: { increment: 1 },
        lastActivationEmailAt: new Date(),
      },
    });
  }

  return { ok: true, sent: dispatched };
}

const CADENCE_KINDS = new Set<ActivationEmailKind>([
  'activation_1', 'activation_2', 'activation_3', 'activation_4',
]);

const SUBJECT_FOR_KIND: Record<ActivationEmailKind, string> = {
  activation_1: 'Your access is ready.',
  activation_2: 'Did you get logged in?',
  activation_3: 'Your access is waiting.',
  activation_4: 'I\'d rather refund you than charge you for nothing.',
  magic_link: 'Your GUNS UP sign-in link',
  password_reset: 'Reset your GUNS UP password',
  tier_upgraded: 'Tier unlocked',
};

interface DispatchInput {
  to: string;
  subject: string;
  operatorId: string;
  kind: ActivationEmailKind;
  magicToken?: string;
  metadata: Record<string, unknown>;
}

/**
 * The actual email send. Currently a structured console log + an
 * EmailLog Prisma write would go here when we add the table.
 *
 * When Resend (or chosen provider) is wired, this becomes:
 *   await resend.emails.send({ from, to, subject, react: <Template /> })
 */
async function dispatch(input: DispatchInput): Promise<boolean> {
  const provider = process.env.EMAIL_PROVIDER || 'console';
  if (provider === 'console') {
    console.log('[activation-email]', JSON.stringify({
      to: input.to,
      subject: input.subject,
      operatorId: input.operatorId,
      kind: input.kind,
      magicTokenPresent: !!input.magicToken,
      metadata: input.metadata,
      ts: new Date().toISOString(),
    }));
    return true;
  }
  // Real-provider implementations land here. Each branch must:
  //   1. Build the email body from src/emails/<kind>.tsx (TODO)
  //   2. Send via provider SDK
  //   3. Return true on success, false otherwise
  console.warn(`[activation-email] provider "${provider}" not yet wired — falling back to console`);
  console.log('[activation-email]', JSON.stringify({ to: input.to, subject: input.subject, kind: input.kind }));
  return true;
}

/**
 * Run the four-email cadence cron. Walks operators who:
 *   - Paid via web (webPurchaseAt set)
 *   - Haven't completed their first workout (firstWorkoutCompletedAt null)
 *
 * For each, decides which email is due (Email 2, 3, or 4) based on
 * elapsed time since webPurchaseAt and how many activation emails
 * have already been sent. Email 1 is sent inline by the Stripe
 * webhook — the cron is a fallback if that send failed.
 *
 * Return shape is the cron summary the route logs.
 */
export async function runActivationEmailScheduler(): Promise<{
  scanned: number;
  email1: number;
  email2: number;
  email3: number;
  email4: number;
}> {
  const now = Date.now();
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  const THREE_DAYS = 3 * 24 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

  const candidates = await prisma.operator.findMany({
    where: {
      webPurchaseAt: { not: null },
      firstWorkoutCompletedAt: null,
      activationEmailsSent: { lt: 4 },
    },
  });

  const counters = { scanned: candidates.length, email1: 0, email2: 0, email3: 0, email4: 0 };

  for (const op of candidates) {
    const result = await processCandidate(op, now, SIX_HOURS, THREE_DAYS, SEVEN_DAYS);
    if (result === 'activation_1') counters.email1++;
    else if (result === 'activation_2') counters.email2++;
    else if (result === 'activation_3') counters.email3++;
    else if (result === 'activation_4') counters.email4++;
  }

  return counters;
}

async function processCandidate(
  op: Operator,
  now: number,
  SIX_HOURS: number,
  THREE_DAYS: number,
  SEVEN_DAYS: number,
): Promise<ActivationEmailKind | null> {
  const purchaseTime = op.webPurchaseAt!.getTime();
  const elapsed = now - purchaseTime;
  const sentCount = op.activationEmailsSent;
  const firstAppOpen = op.firstAppOpenAt;
  const email = op.email;
  if (!email) return null;

  // Decide which email is due based on sent count + elapsed time +
  // whether they've opened the app. Activation 2-4 only fire if
  // app hasn't been opened. The day-7 refund offer fires regardless
  // (covers users who opened the app but never trained).
  const candidate: ActivationEmailKind | null = (() => {
    if (sentCount === 0 && elapsed < 60_000) return 'activation_1'; // catch-up
    if (sentCount === 1 && elapsed >= SIX_HOURS && !firstAppOpen) return 'activation_2';
    if (sentCount === 2 && elapsed >= THREE_DAYS && !firstAppOpen) return 'activation_3';
    if (sentCount === 3 && elapsed >= SEVEN_DAYS) return 'activation_4';
    return null;
  })();

  if (!candidate) return null;

  // Magic link is included on activation_1, _2, _3 — fresh each time.
  let magicToken: string | undefined;
  if (candidate !== 'activation_4') {
    const minted = await mintToken({
      operatorId: op.id,
      type: 'magic_link',
      intent: 'sign_in',
      metadata: { trigger: candidate },
    });
    magicToken = minted.token;
  }

  await queueActivationEmail({
    operatorId: op.id,
    kind: candidate,
    email,
    magicToken,
  });
  return candidate;
}

/**
 * Called by the Stripe webhook on checkout.session.completed.
 * Sends the immediate Email 1 + bumps webPurchaseAt + activationEmailsSent.
 */
export async function fireImmediateActivationEmail(operatorId: string): Promise<void> {
  const op = await prisma.operator.findUnique({ where: { id: operatorId } });
  if (!op || !op.email) return;

  // Mint a magic link for sign-in.
  const minted = await mintToken({
    operatorId: op.id,
    type: 'magic_link',
    intent: 'sign_in',
    metadata: { trigger: 'activation_1' },
  });

  await queueActivationEmail({
    operatorId: op.id,
    kind: 'activation_1',
    email: op.email,
    magicToken: minted.token,
  });

  await prisma.operator.update({
    where: { id: op.id },
    data: {
      webPurchaseAt: op.webPurchaseAt || new Date(),
    },
  });
}
