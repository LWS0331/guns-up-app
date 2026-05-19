# gunnyai-trainer-mcp

Remote MCP server that exposes a trainer's own gunnyai.fit account to Claude.ai. Lets **RAMPAGE** + **VALKYRIE** drive their training data from their existing Claude.ai subscription — **zero Anthropic spend on our infra** for trainer workflows.

In-app Gunny chat is unchanged for every other operator. This is a power surface for the two trainers only.

## What it exposes

Each trainer's MCP connection acts on their **own operator record** (Phase 1 — no client-roster ops yet). Tools:

| Tool | Type | What it does |
|---|---|---|
| `get_my_profile` | read | Operator summary: intake, profile, preferences, sitrep, dailyBrief, nutrition targets, workout dates list, counts |
| `get_today_workout` | read | Today's workout (operator local timezone) |
| `get_workouts_in_range` | read | Workouts keyed in a `from`/`to` YYYY-MM-DD range |
| `get_my_nutrition_today` | read | Today's meals + totals + target gap |
| `get_my_prs` | read | PR board, optional `exercise` filter |
| `get_my_day_tags` | read | Calendar day tags (rest/deload/etc.), optional date range |
| `log_meal` | write | Append meal to `nutrition.meals[date]` |
| `log_pr` | write | Append PR to PR board |
| `set_day_tag` | write | Tag a date `green` / `amber` / `red` / `cyan` |
| `add_or_update_workout` | write | Write a full workout to `workouts[date]` |

## Architecture

```
[Trainer] ──Claude.ai chat──> [Claude.ai] ──MCP HTTP──> [this server] ──REST──> [gunnyai.fit /api]
                              uses their sub                                     requireTrainerAuth
                              (zero $$ to us)                                    (validates key)
```

- **Transport**: Streamable HTTP (MCP spec, stateless per-request).
- **Auth**: same secret end-to-end. Trainer's Bearer token = MCP server's `x-operator-api-key` header to `gunnyai.fit`. One key, one rotation point.
- **Multi-tenant**: single deployment serves both trainers. `OPERATOR_API_KEYS` env maps operator-id → secret. Per-request lookup picks the right operator.

## Setup

### 1. Generate the trainer keys

```bash
openssl rand -hex 32   # run twice — one key per trainer
```

### 2. Set the env on both services

**Both** `gunny-up-app` (Next) **and** `gunnyai-trainer-mcp` (this) need the same `OPERATOR_API_KEYS` value:

```
OPERATOR_API_KEYS={"op-ruben":"<32-byte-hex-1>","op-britney":"<32-byte-hex-2>"}
```

On `gunnyai-trainer-mcp` also set:

```
GUNS_UP_API_URL=https://gunnyai.fit
PORT=3001                            # Railway sets this automatically
PUBLIC_BASE_URL=https://gunnyai-trainer-mcp-production-45fb.up.railway.app
OAUTH_JWT_SECRET=<openssl rand -hex 64>   # signs OAuth access/refresh/code JWTs
```

`PUBLIC_BASE_URL` is the URL Claude.ai connects to (used as OAuth issuer + audience). Set it to your custom domain once `mcp.gunnyai.fit` is live; until then, the Railway-generated domain is the default.

`OAUTH_JWT_SECRET` must be ≥32 chars in production. Generate via `openssl rand -hex 64`. Rotating it invalidates every active OAuth token (trainers will need to re-authorize), so rotate sparingly.

### 3. Deploy to Railway

Add a new service in the existing `Guns-up` Railway project, pointed at this repo:
- **Build**: Dockerfile at `mcp-server/Dockerfile`
- **Healthcheck**: `/health`
- **Root directory**: `mcp-server`

Generate a domain → e.g. `https://mcp.gunnyai.fit`.

### 4. Connect from Claude.ai (OAuth flow)

Claude.ai's Custom Connectors require OAuth 2.1 — our server speaks it. In Claude.ai → Settings → Connectors → **Add custom connector**:

- **Name**: GunnyAI (trainer)
- **URL**: `https://gunnyai-trainer-mcp-production-45fb.up.railway.app/mcp` *(or your custom domain)*
- **No client ID / secret needed** — the server supports Dynamic Client Registration

Click *Connect*. Claude.ai will:
1. Hit `/mcp` with no token, see the `WWW-Authenticate: Bearer resource_metadata=...` header
2. Fetch `/.well-known/oauth-protected-resource` → finds our authorization server
3. Fetch `/.well-known/oauth-authorization-server` → finds `/authorize` + `/token`
4. POST `/register` to dynamically register itself
5. Pop a browser window to `/authorize` — paste your **trainer API key** into the form, click *Authorize*
6. Receive auth code → exchange for access + refresh tokens
7. MCP requests start working with the JWT access token

The trainer API key only gets typed once into the `/authorize` page; after that, Claude.ai stores the OAuth tokens and refreshes them automatically.

#### Connect from Claude Code (legacy static-Bearer flow)

The pre-OAuth static-Bearer path still works for Claude Code:

```bash
claude mcp add --transport http gunnyai-trainer \
  https://gunnyai-trainer-mcp-production-45fb.up.railway.app/mcp \
  --header "Authorization: Bearer <trainer-api-key>"
```

Both auth modes coexist — no migration needed for existing Claude Code connections.

### 5. Set up the Claude.ai Project (per trainer)

Each trainer should create a **dedicated Claude.ai Project** named e.g. `GunnyAI — RAMPAGE` and paste a custom-instructions block so the model knows who it's coaching, when to call which tool, and what safety rails to honor. Pre-written instructions:

- **RAMPAGE / Ruben** → [`PROJECT_INSTRUCTIONS_RAMPAGE.md`](./PROJECT_INSTRUCTIONS_RAMPAGE.md)
- **VALKYRIE / Britney** → [`PROJECT_INSTRUCTIONS_VALKYRIE.md`](./PROJECT_INSTRUCTIONS_VALKYRIE.md)

Copy the `## INSTRUCTIONS` section from the trainer's file into the project's *Custom Instructions* field. Re-paste when the source-of-truth file changes.

## Local dev

```bash
cd mcp-server
npm install
GUNS_UP_API_URL=http://localhost:3000 \
OPERATOR_API_KEYS='{"op-ruben":"dev-key-rampage-aaaaaaaaaaaaaaaa"}' \
npm run dev
```

Smoke test via curl:

```bash
curl -s -X POST http://localhost:3001/mcp \
  -H "authorization: Bearer dev-key-rampage-aaaaaaaaaaaaaaaa" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

You should see the 10 tools listed.

## What's NOT in Phase 1

- **Client roster ops** — "list my clients", "push plan to a client", "log a session for client X". Phase 2.
- **Structured workout modification** (`swap_exercise`, etc.) — for now, `add_or_update_workout` overwrites the whole day. Phase 1.5 if the loop pattern proves clunky.
- **Voice / wearables / billing tools** — out of scope; the in-app surfaces cover them.
- **Per-tool rate limiting** — relies on gunnyai.fit's existing rate limit on the upstream REST calls.
