/**
 * MCP server entry point. Express + Streamable HTTP transport. Stateless
 * per-request (sessionIdGenerator undefined) — every MCP call brings its
 * own Bearer token, we resolve the trainer fresh each time.
 *
 * Deploy as a separate Railway service. The Next app (gunnyai.fit) keeps
 * the per-token Anthropic spend. This service has zero Anthropic spend —
 * the trainer's Claude.ai subscription does the model calls, this just
 * shuttles tool requests through.
 *
 * Health: GET /health → 200 ok. Used by Railway's healthcheck.
 * MCP:    POST /mcp   → streamable HTTP transport. Add to Claude.ai with
 *                       this URL + Authorization: Bearer <trainer-key>.
 */

import express, { Request, Response } from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { loadEnv, lookupOperatorByBearer } from './env.js';
import { GunnyApiClient } from './api-client.js';
import { registerAllTools } from './tools.js';
import { buildGunnyInstructions } from './persona.js';
import {
  handleProtectedResourceMetadata,
  handleAuthorizationServerMetadata,
  handleRegister,
  handleAuthorizeGet,
  handleAuthorizePost,
  handleToken,
  resolveOperatorFromBearer,
} from './oauth.js';

const env = loadEnv();

const app = express();
app.use(express.json({ limit: '4mb' }));
// Form-urlencoded body needed for /authorize POST + /token (OAuth 2.1 token
// endpoint sends application/x-www-form-urlencoded per spec).
app.use(express.urlencoded({ extended: false, limit: '4mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'gunnyai-trainer-mcp',
    trainers: env.operatorKeys.length,
    upstream: env.gunsUpApiUrl,
    publicBaseUrl: env.publicBaseUrl,
    oauthEnabled: true,
  });
});

// ──────────────────────── OAuth 2.1 endpoints ────────────────────────
// Required for Claude.ai Custom Connectors (MCP spec rev 2025-06-18).
// See src/oauth.ts for design notes + RFC references.

app.get('/.well-known/oauth-protected-resource', (req, res) =>
  handleProtectedResourceMetadata(env, req, res)
);
app.get('/.well-known/oauth-authorization-server', (req, res) =>
  handleAuthorizationServerMetadata(env, req, res)
);
app.post('/register', (req, res) => handleRegister(env, req, res));
app.get('/authorize', (req, res) => handleAuthorizeGet(env, req, res));
app.post('/authorize', (req, res) => {
  void handleAuthorizePost(env, req, res);
});
app.post('/token', (req, res) => {
  void handleToken(env, req, res);
});

function extractBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) return header.slice(7).trim();
  // Fall back to x-api-key for tooling that doesn't speak Authorization
  // (some MCP clients still send a generic header). Same secret either way.
  const xKey = req.headers['x-api-key'];
  if (typeof xKey === 'string' && xKey.length > 0) return xKey.trim();
  return null;
}

/** Emit the WWW-Authenticate header per RFC 9728 §5.1 so MCP clients
 * (Claude.ai) know where to find our resource metadata when they hit a
 * 401. Without this, Claude.ai's connector setup can't discover the
 * OAuth flow and just fails opaquely. */
function send401WithChallenge(res: Response, msg: string): void {
  res.set(
    'WWW-Authenticate',
    `Bearer resource_metadata="${env.publicBaseUrl}/.well-known/oauth-protected-resource"`
  );
  res.status(401).json({ error: msg });
}

app.post('/mcp', async (req: Request, res: Response) => {
  const bearer = extractBearer(req);
  if (!bearer) {
    send401WithChallenge(res, 'Missing Authorization: Bearer <token>');
    return;
  }
  // Dual-auth: tries OAuth JWT first (Claude.ai path), falls back to
  // static OPERATOR_API_KEYS lookup (Claude Code's existing path). Keeps
  // both transports working through the OAuth rollout — no need to flip
  // existing Claude Code connections at the same time as Claude.ai
  // onboarding.
  const operatorId = await resolveOperatorFromBearer(env, bearer);
  if (!operatorId) {
    send401WithChallenge(res, 'Unknown or invalid token');
    return;
  }

  // Upstream API key: regardless of how the trainer authenticated to US
  // (static Bearer or OAuth JWT), the call to gunnyai.fit always uses
  // the trainer's gunnyai.fit-side key from OPERATOR_API_KEYS. This is
  // the only piece the Next app (requireTrainerAuth) recognizes. When
  // the trainer presented a JWT, the JWT was just an identity proof —
  // we look up the real upstream key here by operatorId.
  const upstreamKey = env.operatorKeys.find((k) => k.operatorId === operatorId)?.apiKey;
  if (!upstreamKey) {
    // Should not happen: resolveOperatorFromBearer only returns an
    // operatorId present in env.operatorKeys. Defensive 500 in case
    // someone mutates the map at runtime.
    res.status(500).json({ error: 'Operator key not found for resolved operatorId' });
    return;
  }
  void lookupOperatorByBearer; // re-exported, used inside oauth.ts

  // Build a per-request McpServer with the trainer's client baked into
  // the tool closures. Stateless: no session state lives between requests.
  const apiClient = new GunnyApiClient({
    baseUrl: env.gunsUpApiUrl,
    operatorId,
    apiKey: upstreamKey,
  });
  // Ship the Gunny persona via the MCP `instructions` capability — every
  // Claude.ai client (and any other MCP client) reads this at the
  // initialize handshake and uses it as system context. This guarantees
  // the persona even outside the dedicated Claude.ai Project (where the
  // pasted Custom Instructions would otherwise be the only source). The
  // project-level instructions still add per-trainer detail; this is the
  // server-enforced floor that travels with the connection.
  const server = new McpServer(
    {
      name: 'gunnyai-trainer',
      version: '0.1.0',
    },
    {
      instructions: buildGunnyInstructions(operatorId),
    }
  );
  registerAllTools(server, apiClient);

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // stateless
  });
  res.on('close', () => {
    transport.close();
    server.close();
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[mcp] handler error', operatorId, err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'internal MCP error' });
    }
  }
});

// MCP Streamable HTTP also defines GET (server-sent stream) and DELETE
// (session end) — in stateless mode we just reject them with 405 so
// clients know not to try.
app.get('/mcp', (_req, res) => {
  res.status(405).json({ error: 'GET /mcp not supported in stateless mode' });
});
app.delete('/mcp', (_req, res) => {
  res.status(405).json({ error: 'DELETE /mcp not supported in stateless mode' });
});

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(
    `[mcp] gunnyai-trainer-mcp listening on :${env.port} ` +
      `(upstream=${env.gunsUpApiUrl}, trainers=${env.operatorKeys.length})`
  );
});
