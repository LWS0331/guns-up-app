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

const env = loadEnv();

const app = express();
app.use(express.json({ limit: '4mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'gunnyai-trainer-mcp',
    trainers: env.operatorKeys.length,
    upstream: env.gunsUpApiUrl,
  });
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

app.post('/mcp', async (req: Request, res: Response) => {
  const bearer = extractBearer(req);
  if (!bearer) {
    res.status(401).json({ error: 'Missing Authorization: Bearer <token>' });
    return;
  }
  const operatorId = lookupOperatorByBearer(env.operatorKeys, bearer);
  if (!operatorId) {
    res.status(401).json({ error: 'Unknown operator API key' });
    return;
  }

  // Build a per-request McpServer with the trainer's client baked into
  // the tool closures. Stateless: no session state lives between requests.
  const apiClient = new GunnyApiClient({
    baseUrl: env.gunsUpApiUrl,
    operatorId,
    apiKey: bearer,
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
