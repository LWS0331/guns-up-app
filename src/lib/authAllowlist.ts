// Email allowlist for closed beta sign-ups.
//
// Per Ruben: he provides a curated list of authorized emails; only those
// users can register a password OR complete a Google OAuth sign-in. Anyone
// else hitting the auth endpoints is rejected with a clear error message.
//
// Source of truth: AUTHORIZED_EMAILS env var, comma-separated, case-
// insensitive. Whitespace around commas is trimmed.
//
// Behavior:
//   - If AUTHORIZED_EMAILS is unset → allowlist DISABLED (open registration).
//     We log a one-time warning so a missing env var doesn't silently leave
//     the door wide open in production.
//   - If AUTHORIZED_EMAILS is set (even to empty string) → allowlist ENFORCED.
//     Empty string locks everyone out — escape hatch is to unset the var.
//
// To grant a new user access: add their email to AUTHORIZED_EMAILS in
// Railway/Vercel env config and redeploy. No code change required.

let warnedAboutMissingAllowlist = false;

/** Parse the env var into a normalized Set. Re-read on each call so changes
 *  to process.env at runtime (e.g. test fixtures) take effect immediately. */
function getAllowlistFromEnv(): { enabled: boolean; emails: Set<string> } {
  const raw = process.env.AUTHORIZED_EMAILS;
  if (raw === undefined) {
    if (!warnedAboutMissingAllowlist) {
      console.warn(
        '[authAllowlist] AUTHORIZED_EMAILS env var not set — allowlist is DISABLED. ' +
          'Anyone with a valid email can register or sign in via Google. ' +
          'Set AUTHORIZED_EMAILS to a comma-separated list to enforce.',
      );
      warnedAboutMissingAllowlist = true;
    }
    return { enabled: false, emails: new Set() };
  }
  const emails = new Set<string>(
    raw
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter((s) => s.length > 0),
  );
  return { enabled: true, emails };
}

/**
 * Returns true if the given email is allowed to register or sign in.
 * - Allowlist disabled (env var unset) → always true.
 * - Allowlist enabled → email (lower-cased, trimmed) must be in the set.
 */
export function isEmailAuthorized(email: string | null | undefined): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  const { enabled, emails } = getAllowlistFromEnv();
  if (!enabled) return true;
  return emails.has(normalized);
}

/** Standard rejection message; surface as the API error string when blocked. */
export const ALLOWLIST_REJECTION_MESSAGE =
  'This email is not authorized for the GUNS UP closed beta. Contact the team to request access.';
