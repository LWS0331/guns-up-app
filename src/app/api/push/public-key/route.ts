// /api/push/public-key — return the VAPID public key for client-side
// subscribe. Phase 2C + post-launch hardening.
//
// The browser's pushManager.subscribe() needs the VAPID public key as
// a urlBase64-encoded uncompressed P-256 (secp256r1) EC point. If the
// env var is malformed (wrong key pasted, whitespace / quotes
// included, truncated, or — most commonly — the privateKey was pasted
// in place of the publicKey), the browser rejects with:
//   "applicationServerKey must contain a valid P-256 public key"
// which is opaque from the user's perspective. This route validates
// + sanitizes BEFORE handing the value to the client so we surface a
// clear, actionable error.
//
// Validation:
//   - Trim whitespace + strip surrounding quotes
//   - Translate URL-safe base64 to standard base64
//   - Pad to a multiple of 4
//   - Decode with Buffer.from('base64')
//   - Verify length === 65 bytes (uncompressed P-256 point)
//   - Verify first byte === 0x04 (uncompressed point indicator)
//
// If any step fails, we return 503 with diagnostic info so the
// founder/admin can act. The diagnostic does NOT leak the key bytes
// themselves — only structural facts (decoded length, first byte) — so
// it's safe to log + display in dev tools.

import { NextResponse } from 'next/server';

interface VapidValidation {
  ok: true;
  publicKey: string;
}
interface VapidValidationFail {
  ok: false;
  error: string;
  hint: string;
  decodedLength?: number;
  firstByteHex?: string;
}

function validateVapidPublicKey(raw: string | undefined): VapidValidation | VapidValidationFail {
  if (!raw) {
    return {
      ok: false,
      error: 'VAPID_PUBLIC_KEY env var is not set',
      hint: 'Run `npx web-push generate-vapid-keys --json` and paste the publicKey value into Railway env vars.',
    };
  }

  // Sanitize: trim whitespace + strip wrapping quotes a careless paste
  // may have included. Railway's env-var input doesn't strip these
  // automatically.
  const sanitized = raw.trim().replace(/^["']|["']$/g, '').trim();

  if (sanitized.length === 0) {
    return {
      ok: false,
      error: 'VAPID_PUBLIC_KEY is empty after sanitization',
      hint: 'Paste the publicKey value directly without quotes.',
    };
  }

  // URL-safe base64 → standard base64 → bytes.
  const standard = sanitized.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (standard.length % 4)) % 4);
  let decoded: Buffer;
  try {
    decoded = Buffer.from(standard + padding, 'base64');
  } catch (err) {
    return {
      ok: false,
      error: 'VAPID_PUBLIC_KEY is not valid base64',
      hint: `Decode failed: ${(err as Error).message}. Regenerate with web-push CLI and paste cleanly.`,
    };
  }

  // Uncompressed P-256 EC point = 0x04 prefix + 32-byte X + 32-byte Y = 65 bytes total.
  if (decoded.length !== 65) {
    const isLikelyPrivateKey = decoded.length === 32;
    return {
      ok: false,
      error: `VAPID_PUBLIC_KEY decodes to ${decoded.length} bytes (expected 65)`,
      hint: isLikelyPrivateKey
        ? 'It looks like you pasted the PRIVATE key (32 bytes) instead of the PUBLIC key (65 bytes). Swap them in Railway env vars.'
        : 'Regenerate with `npx web-push generate-vapid-keys --json` and paste the `publicKey` field exactly.',
      decodedLength: decoded.length,
      firstByteHex: decoded.length > 0 ? `0x${decoded[0].toString(16).padStart(2, '0')}` : undefined,
    };
  }

  if (decoded[0] !== 0x04) {
    return {
      ok: false,
      error: `VAPID_PUBLIC_KEY first byte is 0x${decoded[0].toString(16).padStart(2, '0')} (expected 0x04 for an uncompressed point)`,
      hint: 'The key is the right length but the wrong format. Regenerate with the web-push CLI.',
      decodedLength: decoded.length,
      firstByteHex: `0x${decoded[0].toString(16).padStart(2, '0')}`,
    };
  }

  return { ok: true, publicKey: sanitized };
}

export async function GET() {
  const raw = process.env.VAPID_PUBLIC_KEY;
  const result = validateVapidPublicKey(raw);

  if ('error' in result) {
    // eslint-disable-next-line no-console
    console.warn('[push/public-key] invalid VAPID config:', result);
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        hint: result.hint,
        ...(result.decodedLength !== undefined ? { decodedLength: result.decodedLength } : {}),
        ...(result.firstByteHex ? { firstByteHex: result.firstByteHex } : {}),
      },
      { status: 503 },
    );
  }
  return NextResponse.json({ ok: true, publicKey: result.publicKey });
}
