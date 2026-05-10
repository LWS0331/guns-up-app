// Token-encryption helper for CalendarConnection rows.
//
// Why we encrypt: Google's access_token + refresh_token are equivalent
// to the operator's calendar — anyone with them can read meetings as
// the operator. Storing them plaintext makes a DB leak game-over for
// every connected calendar. AES-256-GCM with a key derived from
// JWT_SECRET shifts the threat model: an attacker now needs BOTH the
// DB dump AND the JWT_SECRET env var to use the tokens. JWT_SECRET
// already gates JWT signing, so the calendar-token blast radius is
// no worse than session compromise.
//
// Key derivation: HKDF-SHA256(JWT_SECRET, info="gunsup:calendar:v1")
// gives us a calendar-specific key that's distinct from the JWT signing
// key but rotates together. The "v1" tag in info lets us bump to v2
// on a future re-encryption migration without changing the env var.
//
// Format: base64url(iv | ciphertext | authTag) — the three concatenated
// in that order so encryptToken/decryptToken are symmetric. iv is 12
// bytes (GCM standard), authTag is 16 bytes.

import crypto from 'crypto';

const KDF_INFO = 'gunsup:calendar:v1';
const ALGO = 'aes-256-gcm';
const IV_LEN = 12;   // GCM standard
const TAG_LEN = 16;
const KEY_LEN = 32;

let cachedKey: Buffer | null = null;

function deriveKey(): Buffer {
  if (cachedKey) return cachedKey;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error(
      'JWT_SECRET environment variable is required for calendar token encryption.',
    );
  }
  // HKDF with empty salt — the secret already has high entropy, and
  // the per-call salt would have to live somewhere persistent which
  // defeats the purpose. info string keys this derivation to the
  // calendar use-case so the same secret can derive distinct keys
  // for other features later.
  const ikm = Buffer.from(secret, 'utf8');
  const salt = Buffer.alloc(0);
  const info = Buffer.from(KDF_INFO, 'utf8');
  const key = crypto.hkdfSync('sha256', ikm, salt, info, KEY_LEN);
  cachedKey = Buffer.from(key);
  return cachedKey;
}

/**
 * Encrypt a token (access_token or refresh_token) for storage. Returns
 * a base64url string safe to write to a Postgres TEXT column. Throws
 * if JWT_SECRET is missing — call sites should let this propagate; a
 * silent fallback to plaintext storage would defeat the security
 * model.
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) return '';
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, ct, tag]).toString('base64url');
}

/**
 * Decrypt a stored token. Returns null on any failure — corrupt blob,
 * key rotation that orphaned existing rows, etc. Callers should treat
 * null as "this connection needs re-auth" rather than crashing.
 */
export function decryptToken(stored: string | null | undefined): string | null {
  if (!stored) return null;
  let buf: Buffer;
  try {
    buf = Buffer.from(stored, 'base64url');
  } catch {
    return null;
  }
  if (buf.length <= IV_LEN + TAG_LEN) return null;
  try {
    const iv = buf.subarray(0, IV_LEN);
    const tag = buf.subarray(buf.length - TAG_LEN);
    const ct = buf.subarray(IV_LEN, buf.length - TAG_LEN);
    const key = deriveKey();
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
    return pt.toString('utf8');
  } catch {
    // GCM auth-tag mismatch = tampering or wrong key. Either way the
    // stored token is unusable. Caller should re-auth.
    return null;
  }
}

/**
 * Test-only: clear the derived-key cache. Lets tests rotate the
 * secret and observe the next deriveKey() call. Not exported via
 * any production codepath.
 */
export function _resetKeyCacheForTests(): void {
  cachedKey = null;
}
