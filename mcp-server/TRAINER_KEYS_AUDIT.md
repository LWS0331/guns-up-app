# Audit — Trainer API Keys for the GunnyAI MCP Stations

**Audited:** 2026-06-07 · **Branch:** `claude/mcp-valkyrie-rampage-cert-aN2wE`
**Scope:** What the "trainer API keys" actually are, why the two new stations
(VALKYRIE + RAMPAGE on fresh Chrome/Claude.ai licenses) can't authenticate
yet, and the exact path to make them functional.

---

## TL;DR

There is **no external service to "go get" these keys from.** They are
**self-issued secrets** — random bytes we generate ourselves and place into
one env var. The code reads them from `OPERATOR_API_KEYS`, compares them in
constant time, and **never persists them** to the database, the repo, or any
recoverable store. So "getting the keys" is exactly one of two things:

1. **They already exist** → read the current value out of **Railway env**
   (`OPERATOR_API_KEYS`). That env var is the *only* surviving copy.
2. **They don't / you want fresh ones** → **generate** a pair
   (`mcp-server/scripts/gen-trainer-keys.sh`) and **provision both services**.

Either way the two stations become functional once each trainer pastes their
key **once** into the MCP connector's `/authorize` page in Claude.ai.

---

## 1. What a "trainer API key" is (and isn't)

| | |
|---|---|
| **Is** | A random secret string (we use `k_live_<64-hex>`) that maps 1:1 to an operator id (`op-ruben` = RAMPAGE, `op-britney` = VALKYRIE). |
| **Lives in** | The `OPERATOR_API_KEYS` env var — a JSON object `{operatorId: secret}` — set on **two** Railway services. |
| **Isn't** | An OAuth credential from a provider, a DB record, a per-user token issued by an endpoint, or anything stored anywhere we can query after the fact. |

**Proof from the code:**

- `mcp-server/src/env.ts:59-88` — parses `OPERATOR_API_KEYS` from env at
  startup into an in-memory list. Nothing writes it back out.
- `src/lib/requireTrainerAuth.ts:27-41,48-62` — the Next app reads the same
  env per-request, matches the inbound `x-operator-api-key`, and forces
  `role: 'trainer'` on a hit. No DB lookup, no persistence.
- `mcp-server/src/oauth.ts:286-319` — the only place a human ever types the
  key: the `/authorize` form. It's validated against the env map and exchanged
  for OAuth tokens. The raw key is never stored server-side.

Because the keys are never written anywhere durable, **if the current value is
lost it cannot be recovered — only rotated** (generate new, update env,
re-authorize). That's by design (one rotation point, no DB migration), per the
comment block at `src/lib/requireTrainerAuth.ts:5-22`.

---

## 2. Why the two new stations can't authenticate yet

The MCP **path is built and deployed** (Railway, OAuth 2.1 + static-Bearer both
live — `mcp-server/README.md` §Setup). The accounts exist: `op-ruben` and
`op-britney` are in the seed (`src/data/operators.ts:31,320`) and Britney's
prod row was backfilled via `/api/admin/operator-provision`. What's missing is
purely the **shared secret** the new Chrome/Claude.ai sessions present:

- A station with no key configured → MCP server returns **401** with a
  `WWW-Authenticate: Bearer` challenge (`mcp-server/src/index.ts:81-88`).
- A station with the **wrong** key → `Invalid operator API key` / `401`
  (`requireTrainerAuth.ts:31-33`, `env.ts` lookup miss).

So the blocker is "the new stations don't yet hold a valid key," **not** a bug
in the MCP. Fix = put a valid key in front of each station.

---

## 3. How to GET the keys

### Path A — keys already provisioned (most likely if the server is live)

The live value is in Railway and nowhere else. Retrieve it:

```bash
# Railway CLI (run against each service to confirm they MATCH):
railway variables --service gunnyai-trainer-mcp | grep OPERATOR_API_KEYS
railway variables --service guns-up-app        | grep OPERATOR_API_KEYS
```

…or **Railway dashboard → the service → Variables → `OPERATOR_API_KEYS`**.
Copy out `op-ruben`'s value for RAMPAGE's station and `op-britney`'s for
VALKYRIE's. Done — skip to §5.

> If the two services show **different** `OPERATOR_API_KEYS` values, that's a
> latent bug: the MCP forwards the trainer's key to `gunnyai.fit` verbatim
> (`mcp-server/README.md` §Architecture — "same secret end-to-end"). They
> **must be identical.** Treat a mismatch as Path B (rotate to one shared value).

### Path B — generate fresh keys (never provisioned, lost, or rotating)

```bash
cd mcp-server
./scripts/gen-trainer-keys.sh op-ruben op-britney
```

Prints a ready-to-paste `OPERATOR_API_KEYS` JSON + an `OAUTH_JWT_SECRET`.
It writes nothing to disk and commits nothing — secrets stay out of git.

> Manual equivalent: `openssl rand -hex 32` twice, then assemble the JSON
> `{"op-ruben":"…","op-britney":"…"}` (mirrors `mcp-server/README.md` §Setup).

---

## 4. Provision (only needed for Path B)

Set the **same** `OPERATOR_API_KEYS` on **both** services — the MCP relays the
key straight through to the Next API, so a value set on only one side 401s.

| Variable | `guns-up-app` (Next) | `gunnyai-trainer-mcp` |
|---|:---:|:---:|
| `OPERATOR_API_KEYS` | ✅ (identical) | ✅ (identical) |
| `OAUTH_JWT_SECRET` | — | ✅ (`openssl rand -hex 64`, ≥32 chars in prod — enforced at `env.ts:52-57`) |
| `GUNS_UP_API_URL` | — | ✅ `https://gunnyai.fit` |
| `PUBLIC_BASE_URL` | — | ✅ the MCP's public URL |

Redeploy both. No DB migration, no code change — rotation takes effect on the
next request (`requireTrainerAuth.ts:44-47` re-reads env per request).

---

## 5. Make each station functional

Per trainer, on their fresh Chrome/Claude.ai license:

**Claude.ai (Custom Connector, OAuth — recommended):**
1. Settings → Connectors → **Add custom connector**
   - URL: `https://gunnyai-trainer-mcp-production-45fb.up.railway.app/mcp`
     (or the custom domain once `mcp.gunnyai.fit` is live)
   - No client id/secret — the server does Dynamic Client Registration.
2. Click **Connect** → the `/authorize` page pops → paste **that trainer's**
   key (`op-ruben`'s for RAMPAGE, `op-britney`'s for VALKYRIE) → Authorize.
   The key is typed **once**; Claude.ai stores + refreshes OAuth tokens after.
3. Create a Project and paste the matching custom instructions:
   - RAMPAGE → `mcp-server/PROJECT_INSTRUCTIONS_RAMPAGE.md`
   - VALKYRIE → `mcp-server/PROJECT_INSTRUCTIONS_VALKYRIE.md`

**Claude Code (static Bearer, legacy — still supported):**
```bash
claude mcp add --transport http gunnyai-trainer \
  https://gunnyai-trainer-mcp-production-45fb.up.railway.app/mcp \
  --header "Authorization: Bearer <that-trainer-api-key>"
```

**Verify** the station is live (expects a JSON-RPC `result`, not `401`/`error`):
```bash
curl -s -X POST https://gunnyai-trainer-mcp-production-45fb.up.railway.app/mcp \
  -H "authorization: Bearer <that-trainer-api-key>" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## 6. Guardrails (called out by the code + instructions)

- **One key = full own-account read/write.** Never hand a trainer key to a
  client/end-user (`requireTrainerAuth.ts:13-16`). RAMPAGE's key only ever
  goes on RAMPAGE's station; VALKYRIE's on VALKYRIE's.
- **Both services must hold the identical map** or the relay 401s (§4).
- **Keys are unrecoverable once lost** — rotation is the only remedy (§1).
- **Don't commit keys.** They belong in Railway env only; this repo, the
  generator output, and curl history must never carry a real `k_live_…`.
- **Rotating `OAUTH_JWT_SECRET` invalidates every active OAuth token** — both
  trainers would have to re-authorize. Rotate sparingly (`env.ts:47-57`).

---

## 7. Bottom line / recommended action

1. Run `railway variables --service gunnyai-trainer-mcp | grep OPERATOR_API_KEYS`
   (Path A). If both services already share a value → just connect the two new
   stations (§5). **This is the fastest route and likely all that's needed.**
2. If the var is unset, lost, or mismatched across services → `gen-trainer-keys.sh`,
   provision both services (§4), then connect (§5).
3. Either way, finish by running the §5 `curl` from each station's context to
   confirm a green `tools/list`.
