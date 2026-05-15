// Auth token primitives for the post-purchase activation flow.
//
// Three token types:
//   - web_handoff:    iOS app → web upgrade flow. 5-min TTL. Single use.
//                     metadata: { intent: 'upgrade', targetTier }
//   - magic_link:     emailed sign-in link sent post-purchase. 7-day TTL.
//                     metadata: { intent: 'sign_in' }
//   - password_reset: standard password recovery. 1-hour TTL.
//                     metadata: { intent: 'recover' }
//
// Tokens are stored in the AuthToken Prisma model. The "id" returned
// to the caller is a CUID prefixed with the type ("wht_" / "mlk_" /
// "pwr_") so a misuse (e.g. sending a password-reset link to the
// upgrade endpoint) fails fast at parse time instead of after a DB
// round-trip. The DB id and the caller-facing id are distinct — the
// caller-facing id contains the random token surface; the DB id is
// the cuid used for internal indexing.

import { prisma } from '@/lib/db';
import crypto from 'crypto';

export type AuthTokenType = 'web_handoff' | 'magic_link' | 'password_reset';

const TYPE_PREFIX: Record<AuthTokenType, string> = {
  web_handoff: 'wht_',
  magic_link: 'mlk_',
  password_reset: 'pwr_',
};

const TYPE_TTL_MS: Record<AuthTokenType, number> = {
  web_handoff: 5 * 60 * 1000,            // 5 minutes
  magic_link: 7 * 24 * 60 * 60 * 1000,   // 7 days
  password_reset: 60 * 60 * 1000,         // 1 hour
};

export interface MintTokenInput {
  operatorId: string;
  type: AuthTokenType;
  intent?: string;
  metadata?: Record<string, unknown>;
}

export interface MintedToken {
  token: string;        // caller-facing — pass back via URL/email
  expiresAt: Date;
  ttlSeconds: number;
}

/**
 * Mint a fresh single-use auth token. Returns the caller-facing
 * `token` string — the DB id and the random surface combined with
 * the type prefix. URL-safe.
 */
export async function mintToken(input: MintTokenInput): Promise<MintedToken> {
  const ttlMs = TYPE_TTL_MS[input.type];
  const expiresAt = new Date(Date.now() + ttlMs);
  const random = crypto.randomBytes(24).toString('base64url');
  const dbToken = await prisma.authToken.create({
    data: {
      operatorId: input.operatorId,
      type: input.type,
      intent: input.intent || null,
      metadata: input.metadata as object || {},
      expiresAt,
    },
  });
  // Caller-facing token = prefix + random + '.' + db id. The random
  // half is what a verifier matches against; the id is for fast lookup.
  const token = `${TYPE_PREFIX[input.type]}${random}.${dbToken.id}`;
  return { token, expiresAt, ttlSeconds: Math.floor(ttlMs / 1000) };
}

export interface VerifiedToken {
  ok: true;
  operatorId: string;
  type: AuthTokenType;
  intent: string | null;
  metadata: Record<string, unknown>;
  dbId: string;
}

export interface FailedToken {
  ok: false;
  reason: 'malformed' | 'not_found' | 'wrong_type' | 'expired' | 'used';
}

/**
 * Verify a token without consuming it. Use this for read-only checks
 * (e.g. the recovery wizard pre-flight). To consume, call consumeToken.
 */
export async function verifyToken(
  token: string,
  expectedType: AuthTokenType,
): Promise<VerifiedToken | FailedToken> {
  if (!token || typeof token !== 'string') return { ok: false, reason: 'malformed' };
  const expectedPrefix = TYPE_PREFIX[expectedType];
  if (!token.startsWith(expectedPrefix)) return { ok: false, reason: 'wrong_type' };

  const dot = token.lastIndexOf('.');
  if (dot < 0) return { ok: false, reason: 'malformed' };
  const dbId = token.slice(dot + 1);
  if (!dbId) return { ok: false, reason: 'malformed' };

  const row = await prisma.authToken.findUnique({ where: { id: dbId } });
  if (!row) return { ok: false, reason: 'not_found' };
  if (row.type !== expectedType) return { ok: false, reason: 'wrong_type' };
  if (row.used) return { ok: false, reason: 'used' };
  if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' };

  return {
    ok: true,
    operatorId: row.operatorId,
    type: row.type as AuthTokenType,
    intent: row.intent,
    metadata: (row.metadata || {}) as Record<string, unknown>,
    dbId: row.id,
  };
}

/**
 * Verify and atomically mark used. Use this when the token's purpose
 * is being fulfilled (sign-in completed, password reset processed,
 * upgrade flow handed off). Race-safe via the Prisma updateMany
 * conditional on used=false.
 */
export async function consumeToken(
  token: string,
  expectedType: AuthTokenType,
): Promise<VerifiedToken | FailedToken> {
  const v = await verifyToken(token, expectedType);
  if (!v.ok) return v;

  const updated = await prisma.authToken.updateMany({
    where: { id: v.dbId, used: false },
    data: { used: true, usedAt: new Date() },
  });
  if (updated.count === 0) {
    // Lost the race — somebody else consumed it between verify and update.
    return { ok: false, reason: 'used' };
  }
  return v;
}

/**
 * Best-effort cleanup of expired or stale tokens. Called by the
 * daily cron at /api/cron/auth-token-cleanup. Keeps DB lean; not
 * security-critical (verifyToken would reject expired tokens anyway).
 */
export async function cleanupExpiredTokens(olderThanDays = 7): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const result = await prisma.authToken.deleteMany({
    where: { expiresAt: { lt: cutoff } },
  });
  return result.count;
}
