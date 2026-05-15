// Free RECON usage caps — Pricing Strategy v2 makes RECON $0/mo with
// hard rolling-window caps to prevent runaway API spend on free users.
//
// Limits (from RECON_CAPS in src/lib/stripe.ts):
//   - 30 chats per 24h rolling
//   - 5 workout generations per 7d rolling
//
// "Rolling" means the window resets the first time a request lands
// after the previous reset boundary — not on a fixed clock. So a user
// who burns 30 chats in 5 minutes waits 24h from the *first* chat in
// that batch, not until midnight.
//
// All paid tiers (sonnet / opus / white_glove) and admins / trainers
// bypass entirely. Junior operators inherit their parent's tier (which
// is at least OPERATOR via the JUNIOR_OPERATOR_ENABLED billing path).
//
// Usage:
//   const check = await checkChatCap(operatorId);
//   if (!check.allowed) return 429 with check.reason + check.resetAt
//   await incrementChatCount(operatorId);

import { prisma } from '@/lib/db';
import { RECON_CAPS } from '@/lib/stripe';
import { OPS_CENTER_ACCESS } from '@/lib/types';

export type CapKind = 'chat' | 'workout';

export interface CapCheckResult {
  allowed: boolean;
  reason?: string;     // human-readable for surfacing in 429 responses
  remaining?: number;  // requests left in current window
  resetAt?: Date;      // when the window opens back up
  cap?: number;        // total budget for the window
  windowMs?: number;   // window length in ms
  unlimited?: boolean; // tier above RECON or admin/trainer
}

const CHAT_WINDOW_MS = 24 * 60 * 60 * 1000;       // 24h
const WORKOUT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7d

interface OperatorCapsRow {
  id: string;
  tier: string | null;
  role: string | null;
  reconChatsCount: number;
  reconChatsResetAt: Date | null;
  reconWorkoutsCount: number;
  reconWorkoutsResetAt: Date | null;
}

/**
 * Returns true when this operator is exempt from RECON caps:
 * paid tier (anything other than haiku), trainer, or admin.
 */
function isCapExempt(op: { id?: string; tier?: string | null; role?: string | null }): boolean {
  if (!op) return false;
  if (op.role === 'trainer') return true;
  if (op.id && OPS_CENTER_ACCESS.includes(op.id)) return true;
  return op.tier !== 'haiku' && op.tier != null;
}

/**
 * Check whether the operator can perform another action of the given
 * kind. Does NOT increment the counter — call increment*() after the
 * action actually fires.
 */
export async function checkCap(operatorId: string, kind: CapKind): Promise<CapCheckResult> {
  const op = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: {
      id: true,
      tier: true,
      role: true,
      reconChatsCount: true,
      reconChatsResetAt: true,
      reconWorkoutsCount: true,
      reconWorkoutsResetAt: true,
    },
  });
  if (!op) {
    return { allowed: false, reason: 'Operator not found.' };
  }
  if (isCapExempt(op)) {
    return { allowed: true, unlimited: true };
  }
  return computeCap(op as OperatorCapsRow, kind, /* increment= */ false);
}

/**
 * Atomically check + increment. Returns a CapCheckResult — if allowed
 * is true, the counter has already been bumped. If false, no write
 * happened. The caller decides whether to honor the action.
 */
export async function checkAndIncrement(operatorId: string, kind: CapKind): Promise<CapCheckResult> {
  const op = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: {
      id: true,
      tier: true,
      role: true,
      reconChatsCount: true,
      reconChatsResetAt: true,
      reconWorkoutsCount: true,
      reconWorkoutsResetAt: true,
    },
  });
  if (!op) {
    return { allowed: false, reason: 'Operator not found.' };
  }
  if (isCapExempt(op)) {
    return { allowed: true, unlimited: true };
  }
  const result = computeCap(op as OperatorCapsRow, kind, /* increment= */ true);
  if (!result.allowed) return result;

  // Persist the new counter + reset boundary.
  if (kind === 'chat') {
    await prisma.operator.update({
      where: { id: operatorId },
      data: {
        reconChatsCount: result._nextCount!,
        reconChatsResetAt: result._nextResetAt!,
      },
    });
  } else {
    await prisma.operator.update({
      where: { id: operatorId },
      data: {
        reconWorkoutsCount: result._nextCount!,
        reconWorkoutsResetAt: result._nextResetAt!,
      },
    });
  }
  return result;
}

/**
 * Pure function: given the operator's current cap state, decide if
 * an action is allowed, and (if `increment` is true) compute the new
 * counter + reset timestamp. Returns the projected next-state values
 * on internal underscore-prefixed fields for the caller to persist.
 */
function computeCap(
  op: OperatorCapsRow,
  kind: CapKind,
  increment: boolean,
): CapCheckResult & { _nextCount?: number; _nextResetAt?: Date } {
  const now = new Date();
  const cap = kind === 'chat' ? RECON_CAPS.CHATS_PER_24H : RECON_CAPS.WORKOUTS_PER_7D;
  const windowMs = kind === 'chat' ? CHAT_WINDOW_MS : WORKOUT_WINDOW_MS;
  const currentCount = kind === 'chat' ? op.reconChatsCount : op.reconWorkoutsCount;
  const currentResetAt = kind === 'chat' ? op.reconChatsResetAt : op.reconWorkoutsResetAt;

  // Has the rolling window expired? If yes, reset the counter.
  let effectiveCount = currentCount;
  let effectiveResetAt = currentResetAt;
  if (!effectiveResetAt || effectiveResetAt.getTime() <= now.getTime()) {
    effectiveCount = 0;
    effectiveResetAt = new Date(now.getTime() + windowMs);
  }

  const remaining = Math.max(0, cap - effectiveCount);

  if (effectiveCount >= cap) {
    return {
      allowed: false,
      remaining: 0,
      cap,
      windowMs,
      resetAt: effectiveResetAt!,
      reason: kind === 'chat'
        ? `Daily chat cap reached (${cap}/24h). Upgrade to OPERATOR for unlimited chat. Resets ${effectiveResetAt!.toISOString()}.`
        : `Weekly workout-generation cap reached (${cap}/7d). Upgrade to OPERATOR for unlimited generations. Resets ${effectiveResetAt!.toISOString()}.`,
    };
  }

  if (increment) {
    return {
      allowed: true,
      remaining: remaining - 1,
      cap,
      windowMs,
      resetAt: effectiveResetAt!,
      _nextCount: effectiveCount + 1,
      _nextResetAt: effectiveResetAt!,
    };
  }

  return {
    allowed: true,
    remaining,
    cap,
    windowMs,
    resetAt: effectiveResetAt!,
  };
}

/**
 * Convenience wrapper: 429 JSON response builder for routes that
 * already have NextResponse imported.
 */
export function capExceededBody(result: CapCheckResult) {
  return {
    error: result.reason || 'Usage cap exceeded.',
    cap: result.cap,
    resetAt: result.resetAt?.toISOString() || null,
    upgradeRequired: 'sonnet',  // OPERATOR clears all RECON caps
  };
}
