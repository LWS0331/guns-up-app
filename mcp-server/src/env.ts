/**
 * Centralized env-var parsing. Fail loud + early on startup if anything
 * critical is missing — better than discovering it on the first MCP call.
 */

export interface OperatorKeyEntry {
  operatorId: string;
  apiKey: string;
}

export interface Env {
  port: number;
  gunsUpApiUrl: string;
  operatorKeys: OperatorKeyEntry[];
  /** Public origin of THIS MCP server (e.g. https://mcp.gunnyai.fit).
   * Used as the issuer/audience in OAuth metadata + JWTs. */
  publicBaseUrl: string;
  /** HS256 secret for signing OAuth JWTs (access tokens + auth codes +
   * refresh tokens). Min 32 bytes. */
  oauthJwtSecret: string;
}

export function loadEnv(): Env {
  const port = parseInt(process.env.PORT || '3001', 10);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(`Invalid PORT: ${process.env.PORT}`);
  }

  const gunsUpApiUrl = (process.env.GUNS_UP_API_URL || '').replace(/\/$/, '');
  if (!gunsUpApiUrl) {
    throw new Error('GUNS_UP_API_URL is required (e.g. https://gunnyai.fit)');
  }

  // PUBLIC_BASE_URL: where this MCP server is reachable from the public
  // internet — Claude.ai uses it as the OAuth issuer + audience. Defaults
  // to the Railway-generated domain so dev works without setting it; in
  // prod you should set it explicitly once the trainer custom domain
  // (mcp.gunnyai.fit) is live.
  const publicBaseUrl = (
    process.env.PUBLIC_BASE_URL ||
    'https://gunnyai-trainer-mcp-production-45fb.up.railway.app'
  ).replace(/\/$/, '');
  if (!/^https?:\/\//.test(publicBaseUrl)) {
    throw new Error(`PUBLIC_BASE_URL must start with http:// or https:// — got ${publicBaseUrl}`);
  }

  // OAUTH_JWT_SECRET: signs access tokens, auth codes, refresh tokens.
  // 32+ bytes recommended (HS256). Generate with `openssl rand -hex 64`.
  // Falls back to a hash of OPERATOR_API_KEYS for dev so smoke tests
  // work without an extra env, but in prod set it explicitly so token
  // rotation is independent of key rotation.
  const oauthJwtSecret = process.env.OAUTH_JWT_SECRET || '';
  if (process.env.NODE_ENV === 'production' && oauthJwtSecret.length < 32) {
    throw new Error(
      'OAUTH_JWT_SECRET must be set in production (32+ chars). Generate via `openssl rand -hex 64`.'
    );
  }

  const rawKeys = process.env.OPERATOR_API_KEYS;
  if (!rawKeys) {
    throw new Error(
      'OPERATOR_API_KEYS is required. Set to a JSON object mapping operator-id → secret, e.g. ' +
        '{"op-ruben":"k_live_rampage_xxx","op-britney":"k_live_valkyrie_yyy"}'
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawKeys);
  } catch (e) {
    throw new Error(`OPERATOR_API_KEYS is not valid JSON: ${(e as Error).message}`);
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('OPERATOR_API_KEYS must be a JSON object {operatorId: apiKey}');
  }

  const operatorKeys: OperatorKeyEntry[] = [];
  for (const [operatorId, apiKey] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof apiKey !== 'string' || apiKey.length < 16) {
      throw new Error(
        `OPERATOR_API_KEYS[${operatorId}] must be a string of at least 16 chars`
      );
    }
    operatorKeys.push({ operatorId, apiKey });
  }
  if (operatorKeys.length === 0) {
    throw new Error('OPERATOR_API_KEYS is empty — no trainers can authenticate');
  }

  // Dev fallback for the OAuth secret — derive a stable string from the
  // operator keys so a forgotten env var doesn't crash local dev. NOT
  // used in production (rejected above).
  const effectiveJwtSecret = oauthJwtSecret || (
    'dev-only-' + operatorKeys.map((k) => k.apiKey.slice(0, 8)).join('-')
  );

  return {
    port,
    gunsUpApiUrl,
    operatorKeys,
    publicBaseUrl,
    oauthJwtSecret: effectiveJwtSecret,
  };
}

/**
 * Constant-time-ish lookup of operator-id by bearer token. Linear scan
 * (tiny map), but each compare uses a length-stable XOR loop so we don't
 * leak which operator-ids exist via timing.
 */
export function lookupOperatorByBearer(
  keys: OperatorKeyEntry[],
  bearer: string
): string | null {
  let matched: string | null = null;
  for (const entry of keys) {
    if (constantTimeEqual(entry.apiKey, bearer)) {
      matched = entry.operatorId;
    }
  }
  return matched;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
