/**
 * Minimal OAuth 2.1 server for Claude.ai Custom Connectors compatibility.
 *
 * Implements the slice of OAuth 2.1 the MCP spec (rev 2025-06-18) and
 * Claude.ai's Custom Connectors require:
 *
 *   • RFC 9728  Protected Resource Metadata  → /.well-known/oauth-protected-resource
 *   • RFC 8414  Authorization Server Metadata → /.well-known/oauth-authorization-server
 *   • RFC 7591  Dynamic Client Registration   → POST /register  (open, no auth)
 *   • RFC 7636  PKCE (S256 only)              → enforced in /authorize + /token
 *   • RFC 8707  Resource Indicators            → resource= param validated
 *   • OAuth 2.1 authorization_code grant       → /authorize + /token
 *   • OAuth 2.1 refresh_token grant            → /token (refresh)
 *
 * Auth model — closed enrollment, two trainers:
 *   • The user's "credential" is their personal trainer API key (the same
 *     one already in OPERATOR_API_KEYS). The /authorize HTML form asks
 *     for it; the operator-id we look up becomes the JWT `sub`.
 *   • Access tokens, auth codes, refresh tokens are all stateless JWTs.
 *     No DB, no Redis. JWT `jti` + an in-memory used-codes set protects
 *     against replay within the code's short TTL.
 *   • Single replica today. If we ever go multi-replica, swap the
 *     in-memory set for Redis or use the JWT `jti` as a DB unique key.
 *
 * Backwards compat: the existing static-Bearer flow on /mcp still works.
 * verifyMcpToken tries JWT first, falls back to operator-key lookup —
 * so Claude Code's existing connection isn't broken by this change.
 */

import { Request, Response } from 'express';
import { SignJWT, jwtVerify, errors as joseErrors } from 'jose';
import { createHash, randomBytes } from 'node:crypto';
import { Env, lookupOperatorByBearer } from './env.js';

const ACCESS_TOKEN_TTL_SEC = 3600;          // 1h
const REFRESH_TOKEN_TTL_SEC = 30 * 86400;   // 30d
const AUTH_CODE_TTL_SEC = 120;              // 2 min — short, single-use
const TOKEN_TYPE_ACCESS = 'access';
const TOKEN_TYPE_REFRESH = 'refresh';
const TOKEN_TYPE_CODE = 'code';

/** In-memory set of used auth-code jti values. Single replica only —
 * if we ever scale out, swap for Redis. TTL aligned with code TTL. */
const usedCodes = new Map<string, number>(); // jti → expiry ms

function recordUsedCode(jti: string): void {
  pruneUsedCodes();
  usedCodes.set(jti, Date.now() + AUTH_CODE_TTL_SEC * 1000);
}
function isCodeUsed(jti: string): boolean {
  pruneUsedCodes();
  return usedCodes.has(jti);
}
function pruneUsedCodes(): void {
  const now = Date.now();
  for (const [jti, exp] of usedCodes.entries()) {
    if (exp < now) usedCodes.delete(jti);
  }
}

function secretKey(env: Env): Uint8Array {
  return new TextEncoder().encode(env.oauthJwtSecret);
}

// ───────────────────────── JWT issuance/verify ─────────────────────────

interface BaseClaims {
  sub: string;       // operatorId
  resource: string;  // MCP server canonical URL
}

interface CodeClaims extends BaseClaims {
  code_challenge: string;
  redirect_uri: string;
  client_id: string;
}

async function signToken(
  env: Env,
  type: typeof TOKEN_TYPE_ACCESS | typeof TOKEN_TYPE_REFRESH | typeof TOKEN_TYPE_CODE,
  claims: Record<string, unknown>,
  ttlSec: number
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jti = randomBytes(16).toString('hex');
  return await new SignJWT({ ...claims, token_type: type })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(env.publicBaseUrl)
    .setAudience(
      type === TOKEN_TYPE_ACCESS
        ? env.publicBaseUrl
        : `${env.publicBaseUrl}/token`
    )
    .setIssuedAt(now)
    .setExpirationTime(now + ttlSec)
    .setJti(jti)
    .sign(secretKey(env));
}

async function verifyToken(
  env: Env,
  token: string,
  expectedType: string,
  expectedAud: string
): Promise<Record<string, unknown> | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(env), {
      issuer: env.publicBaseUrl,
      audience: expectedAud,
    });
    if (payload.token_type !== expectedType) return null;
    return payload as Record<string, unknown>;
  } catch (e) {
    if (
      e instanceof joseErrors.JWTExpired ||
      e instanceof joseErrors.JWTInvalid ||
      e instanceof joseErrors.JWSSignatureVerificationFailed ||
      e instanceof joseErrors.JWTClaimValidationFailed
    ) {
      return null;
    }
    throw e;
  }
}

// ───────────────────── /mcp dual-auth (JWT or static) ─────────────────────

/**
 * Resolve a presented Bearer token to an operatorId. Tries OAuth JWT
 * first (the new Claude.ai path) and falls back to OPERATOR_API_KEYS
 * static lookup (the existing Claude Code path). Returns null if
 * neither matches.
 */
export async function resolveOperatorFromBearer(
  env: Env,
  bearer: string
): Promise<string | null> {
  // Try OAuth JWT first.
  if (looksLikeJwt(bearer)) {
    const claims = await verifyToken(env, bearer, TOKEN_TYPE_ACCESS, env.publicBaseUrl);
    if (claims && typeof claims.sub === 'string') {
      // Audience validation already done by jwtVerify above. Belt-and-
      // suspenders: confirm the resource claim matches our public URL.
      if (claims.resource && claims.resource !== env.publicBaseUrl) return null;
      return claims.sub;
    }
  }
  // Fall back to static operator key (unchanged from pre-OAuth behavior).
  return lookupOperatorByBearer(env.operatorKeys, bearer);
}

function looksLikeJwt(s: string): boolean {
  return s.split('.').length === 3 && s.length > 50;
}

// ───────────────────── Discovery endpoints (RFC 9728 + RFC 8414) ─────────────────────

export function handleProtectedResourceMetadata(env: Env, _req: Request, res: Response): void {
  // RFC 9728 — Protected Resource Metadata. Points clients at the
  // authorization server (us). Claude.ai reads this after getting a 401
  // with WWW-Authenticate.
  res.json({
    resource: env.publicBaseUrl,
    authorization_servers: [env.publicBaseUrl],
    bearer_methods_supported: ['header'],
    resource_documentation: `${env.publicBaseUrl}/`,
  });
}

export function handleAuthorizationServerMetadata(env: Env, _req: Request, res: Response): void {
  // RFC 8414 — Authorization Server Metadata. Declares our endpoints.
  res.json({
    issuer: env.publicBaseUrl,
    authorization_endpoint: `${env.publicBaseUrl}/authorize`,
    token_endpoint: `${env.publicBaseUrl}/token`,
    registration_endpoint: `${env.publicBaseUrl}/register`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'], // public clients (PKCE)
    scopes_supported: ['mcp'],
  });
}

// ───────────────────── /register (RFC 7591 Dynamic Client Registration) ─────────────────────

export function handleRegister(env: Env, req: Request, res: Response): void {
  const body = (req.body || {}) as {
    redirect_uris?: string[];
    client_name?: string;
    token_endpoint_auth_method?: string;
  };
  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
  if (redirectUris.length === 0) {
    res.status(400).json({ error: 'invalid_redirect_uri', error_description: 'redirect_uris required' });
    return;
  }
  // We accept any client_id — PKCE protects the flow. Generate a stable
  // one per registration so clients can persist it.
  const clientId = `mcp-client-${randomBytes(12).toString('hex')}`;
  res.status(201).json({
    client_id: clientId,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    redirect_uris: redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
    client_name: body.client_name || 'GunnyAI Trainer MCP Client',
  });
  void env; // unused; kept for symmetry
}

// ───────────────────── /authorize (GET + POST) ─────────────────────

export function handleAuthorizeGet(env: Env, req: Request, res: Response): void {
  // Render a tiny HTML form. The trainer enters their personal API key,
  // we validate, then redirect to the client's redirect_uri with a code.
  const params = req.query as Record<string, string | undefined>;
  const required = ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state'];
  for (const k of required) {
    if (!params[k]) {
      res.status(400).type('text/plain').send(`Missing required param: ${k}`);
      return;
    }
  }
  if (params.response_type !== 'code') {
    res.status(400).type('text/plain').send('Only response_type=code is supported');
    return;
  }
  if (params.code_challenge_method !== 'S256') {
    res.status(400).type('text/plain').send('Only code_challenge_method=S256 is supported');
    return;
  }
  // Resource param: optional per RFC 8707 but Claude.ai sends it. If
  // present it must match our canonical URL. Per MCP spec (rev 2025-06-18,
  // Resource Parameter Implementation > Canonical Server URI note):
  // "implementations SHOULD consistently use the form without the trailing
  // slash for better interoperability" — but Claude.ai sends the trailing-
  // slash form. Normalize both sides before comparing so this isn't a
  // string-equality landmine.
  if (params.resource && normalizeResourceUri(params.resource) !== normalizeResourceUri(env.publicBaseUrl)) {
    res.status(400).type('text/plain').send(
      `resource parameter mismatch: got ${params.resource}, expected ${env.publicBaseUrl}`
    );
    return;
  }

  // Hidden inputs round-trip the OAuth params back to POST /authorize.
  const hidden = Object.entries(params)
    .filter(([_k, v]) => typeof v === 'string')
    .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v as string)}" />`)
    .join('\n');

  res.type('text/html').send(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>GunnyAI — Authorize</title>
  <style>
    body { font-family: -apple-system, system-ui, sans-serif; background: #030303; color: #ddd; margin: 0; padding: 40px 24px; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { max-width: 420px; width: 100%; background: #0a0a0a; border: 1px solid rgba(255,184,0,0.2); padding: 32px; border-radius: 4px; }
    h1 { color: #ffb800; font-family: Orbitron, sans-serif; font-size: 22px; letter-spacing: 2px; margin: 0 0 8px; }
    p.sub { color: #888; font-size: 14px; margin: 0 0 24px; }
    label { display: block; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; margin: 16px 0 6px; }
    input[type=password] { width: 100%; padding: 12px; font: 14px/1.4 'SF Mono', monospace; background: #000; color: #00ff41; border: 1px solid #222; box-sizing: border-box; }
    input[type=password]:focus { outline: none; border-color: #ffb800; }
    button { width: 100%; padding: 14px; margin-top: 24px; background: #ffb800; color: #030303; border: 0; font: 700 13px/1 Orbitron, sans-serif; letter-spacing: 2px; cursor: pointer; }
    .meta { color: #555; font-size: 11px; margin-top: 16px; word-break: break-all; }
  </style>
</head>
<body>
  <form method="POST" action="/authorize" class="card">
    <h1>GunnyAI — Authorize</h1>
    <p class="sub">Paste your trainer API key to grant this client access to your training data.</p>
    <label>Trainer API key</label>
    <input type="password" name="api_key" autocomplete="off" autofocus required placeholder="k_live_…" />
    <button type="submit">◆ AUTHORIZE</button>
    <div class="meta">Client: ${escapeHtml((params.client_id as string) || '?')}<br/>Redirect: ${escapeHtml((params.redirect_uri as string) || '?')}</div>
    ${hidden}
  </form>
</body>
</html>`);
}

export async function handleAuthorizePost(env: Env, req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, string | undefined>;
  const apiKey = (body.api_key || '').trim();
  const operatorId = apiKey ? lookupOperatorByBearer(env.operatorKeys, apiKey) : null;
  const redirectUri = body.redirect_uri || '';
  const state = body.state || '';

  if (!operatorId) {
    res.status(401).type('text/plain').send('Invalid trainer API key.');
    return;
  }
  if (!redirectUri || !body.code_challenge || !body.client_id) {
    res.status(400).type('text/plain').send('Missing OAuth params on submit.');
    return;
  }

  // Issue a short-lived auth code JWT carrying the PKCE challenge +
  // redirect URI + client_id so /token can verify them. Storing them in
  // the JWT itself keeps the server stateless across replicas.
  const codeClaims: Record<string, unknown> = {
    sub: operatorId,
    resource: env.publicBaseUrl,
    code_challenge: body.code_challenge,
    redirect_uri: redirectUri,
    client_id: body.client_id,
  };
  const code = await signToken(env, TOKEN_TYPE_CODE, codeClaims, AUTH_CODE_TTL_SEC);

  // Redirect back to the client with the code (+ state for CSRF).
  const url = new URL(redirectUri);
  url.searchParams.set('code', code);
  if (state) url.searchParams.set('state', state);
  res.redirect(302, url.toString());
}

// ───────────────────── /token ─────────────────────

export async function handleToken(env: Env, req: Request, res: Response): Promise<void> {
  const body = (req.body || {}) as Record<string, string | undefined>;
  const grantType = body.grant_type;

  if (grantType === 'authorization_code') {
    await handleAuthCodeGrant(env, body, res);
    return;
  }
  if (grantType === 'refresh_token') {
    await handleRefreshGrant(env, body, res);
    return;
  }
  res.status(400).json({ error: 'unsupported_grant_type', error_description: `grant_type=${grantType}` });
}

async function handleAuthCodeGrant(
  env: Env,
  body: Record<string, string | undefined>,
  res: Response
): Promise<void> {
  const code = body.code;
  const codeVerifier = body.code_verifier;
  const redirectUri = body.redirect_uri;
  const clientId = body.client_id;
  if (!code || !codeVerifier || !redirectUri) {
    res.status(400).json({ error: 'invalid_request', error_description: 'code, code_verifier, redirect_uri required' });
    return;
  }

  const claims = await verifyToken(env, code, TOKEN_TYPE_CODE, `${env.publicBaseUrl}/token`);
  if (!claims) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'auth code invalid or expired' });
    return;
  }
  // Single-use: reject reused codes within their TTL.
  const jti = String(claims.jti || '');
  if (jti && isCodeUsed(jti)) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'auth code already redeemed' });
    return;
  }
  if (claims.redirect_uri !== redirectUri) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'redirect_uri mismatch' });
    return;
  }
  if (clientId && claims.client_id !== clientId) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'client_id mismatch' });
    return;
  }
  // PKCE: SHA256(code_verifier) base64url == code_challenge
  const computed = createHash('sha256').update(codeVerifier).digest('base64url');
  if (computed !== claims.code_challenge) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
    return;
  }
  if (jti) recordUsedCode(jti);

  const operatorId = String(claims.sub);
  const accessToken = await signToken(env, TOKEN_TYPE_ACCESS, {
    sub: operatorId,
    resource: env.publicBaseUrl,
  }, ACCESS_TOKEN_TTL_SEC);
  const refreshToken = await signToken(env, TOKEN_TYPE_REFRESH, {
    sub: operatorId,
    resource: env.publicBaseUrl,
  }, REFRESH_TOKEN_TTL_SEC);

  res.json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SEC,
    refresh_token: refreshToken,
    scope: 'mcp',
  });
}

async function handleRefreshGrant(
  env: Env,
  body: Record<string, string | undefined>,
  res: Response
): Promise<void> {
  const refreshToken = body.refresh_token;
  if (!refreshToken) {
    res.status(400).json({ error: 'invalid_request', error_description: 'refresh_token required' });
    return;
  }
  const claims = await verifyToken(env, refreshToken, TOKEN_TYPE_REFRESH, `${env.publicBaseUrl}/token`);
  if (!claims) {
    res.status(400).json({ error: 'invalid_grant', error_description: 'refresh token invalid or expired' });
    return;
  }
  const operatorId = String(claims.sub);
  const newAccess = await signToken(env, TOKEN_TYPE_ACCESS, {
    sub: operatorId,
    resource: env.publicBaseUrl,
  }, ACCESS_TOKEN_TTL_SEC);
  // Rotate refresh token (OAuth 2.1 SHOULD).
  const newRefresh = await signToken(env, TOKEN_TYPE_REFRESH, {
    sub: operatorId,
    resource: env.publicBaseUrl,
  }, REFRESH_TOKEN_TTL_SEC);
  res.json({
    access_token: newAccess,
    token_type: 'Bearer',
    expires_in: ACCESS_TOKEN_TTL_SEC,
    refresh_token: newRefresh,
    scope: 'mcp',
  });
}

// ───────────────────── Helpers ─────────────────────

/**
 * Strip trailing slashes for resource-URI comparison. RFC 8707 + MCP spec
 * are explicit that the trailing slash is not semantically significant
 * for an MCP server's canonical URI, but neither side enforces a single
 * form — so clients (including Claude.ai) can legitimately send either.
 * Normalize both sides before comparing.
 */
function normalizeResourceUri(uri: string): string {
  return uri.replace(/\/+$/, '');
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c] as string));
}
