import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from './requireAuth';

/**
 * Trainer-friendly auth: accept EITHER the existing JWT (web app) OR an
 * `x-operator-api-key` header (MCP server / external scripts).
 *
 * API-key path is gated on the OPERATOR_API_KEYS env var — a JSON object
 * mapping operator-id → secret, e.g.:
 *
 *   OPERATOR_API_KEYS='{"op-ruben":"k_live_rampage_…","op-britney":"k_live_valkyrie_…"}'
 *
 * Issue keys via `openssl rand -hex 32` and store in Railway env. Rotation
 * = update the env value, no DB migration. Whoever holds the key gets full
 * own-account read/write — meant only for the trainer themselves and their
 * dedicated MCP server. NEVER hand a key to a client/end-user.
 *
 * On API-key match, `role` is forced to "trainer" (the source-of-truth
 * role lives in the JWT for web users; API-key holders are by definition
 * trainers since clients don't get keys).
 *
 * Returns same shape as requireAuth so every route swaps in cleanly.
 */
export function requireTrainerAuth(req: NextRequest):
  | { operatorId: string; role: string; source: 'jwt' | 'api-key' }
  | NextResponse {
  const apiKey = req.headers.get('x-operator-api-key');
  if (apiKey) {
    const map = parseOperatorApiKeysEnv();
    const operatorId = lookupOperatorByKey(map, apiKey);
    if (!operatorId) {
      return NextResponse.json({ error: 'Invalid operator API key' }, { status: 401 });
    }
    return { operatorId, role: 'trainer', source: 'api-key' };
  }

  // Fall through to JWT — preserves the existing web auth path verbatim.
  const jwt = requireAuth(req);
  if (jwt instanceof NextResponse) return jwt;
  return { ...jwt, source: 'jwt' };
}

/**
 * Parse OPERATOR_API_KEYS once per request. Cheap — the env is a small
 * object. We deliberately don't cache across requests so rotation via
 * Railway env-var update takes effect on the next request (no restart).
 */
function parseOperatorApiKeysEnv(): Record<string, string> {
  const raw = process.env.OPERATOR_API_KEYS;
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    // Malformed env — refuse silently, returns empty map so all keys 401.
    // Logged once at startup would be nicer, but we don't want to spam
    // server logs on every request if someone deploys with bad JSON.
  }
  return {};
}

/**
 * Constant-time lookup: walk every entry and compare. Avoids timing leaks
 * that would let an attacker enumerate which operator-ids exist. The map
 * is tiny (2 trainers today, maybe 10 long term) — linear scan is fine.
 */
function lookupOperatorByKey(map: Record<string, string>, candidate: string): string | null {
  let matched: string | null = null;
  for (const [opId, secret] of Object.entries(map)) {
    if (timingSafeEqual(secret, candidate)) {
      matched = opId;
    }
  }
  return matched;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
