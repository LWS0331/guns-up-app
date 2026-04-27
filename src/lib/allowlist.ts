// Closed-beta access allowlist.
//
// Policy (per Ruben, April 2026): only operators whose email has been
// explicitly assigned by an admin are allowed to authenticate. The
// `Operator.email` column is the source of truth — having an email set
// IS the allowlist membership. A NULL email = locked out.
//
// Activation pathway: POST /api/admin/set-emails (bulk) or
// POST /api/admin/set-pin (then /api/admin/set-emails). Only admins can
// activate.
//
// Bypasses (always allowed regardless of email state):
//   - OPS_CENTER_ACCESS members (Ruben, Britney) — platform owners
//
// All authenticated routes use isOperatorAllowed() as a gate. The four
// surfaces it lives on:
//   - POST /api/auth/login (PIN + email/password paths)
//   - GET  /api/auth/me   (kicks stale JWTs out on next call)
//   - POST /api/auth/recover (don't magic-link non-allowlisted)
//   - POST /api/auth/magic-link (send path; consume path is gated by
//     the token itself which can only be minted for allowlisted ops)

import { OPS_CENTER_ACCESS } from '@/lib/types';

interface OperatorAllowlistRow {
  id?: string;
  email?: string | null;
}

/**
 * Returns true when the operator is allowed to authenticate.
 *
 *   - Admins (OPS_CENTER_ACCESS) always pass — even with NULL email.
 *   - Otherwise the operator must have a non-empty `email`.
 *
 * Caller is responsible for surfacing the right error message
 * (we don't throw — we return false and let the caller pick the
 * 403 vs 401 vs 404 response shape).
 */
export function isOperatorAllowed(op: OperatorAllowlistRow | null | undefined): boolean {
  if (!op) return false;
  if (op.id && OPS_CENTER_ACCESS.includes(op.id)) return true;
  return typeof op.email === 'string' && op.email.trim().length > 0;
}

/**
 * Standard 403 body for non-allowlisted operators. Same message
 * everywhere so we don't leak which exact step rejected them.
 */
export const NOT_ALLOWED_RESPONSE = {
  error: 'Not activated',
  message: 'This account is not yet active for the closed beta. Contact Ruben to request access.',
} as const;
