#!/usr/bin/env bash
#
# gen-trainer-keys.sh — mint trainer API keys for the gunnyai-trainer MCP.
#
# WHY THIS EXISTS
#   Trainer "API keys" are not credentials fetched from any provider. They
#   are self-issued secrets: random bytes we generate, then place verbatim
#   into the OPERATOR_API_KEYS env var on BOTH Railway services. There is no
#   vault, no DB row, no API to retrieve them from after the fact — the only
#   copy that survives is whatever you paste into Railway (and the OAuth
#   token Claude.ai stores once a trainer authorizes). See:
#     - mcp-server/src/env.ts            (parses OPERATOR_API_KEYS)
#     - src/lib/requireTrainerAuth.ts    (matches the inbound key)
#     - mcp-server/src/oauth.ts          (one-time /authorize paste)
#
# WHAT IT DOES
#   Generates one fresh 32-byte hex key per operator id passed in, prints a
#   ready-to-paste OPERATOR_API_KEYS JSON value, and a matching OAUTH_JWT_SECRET.
#   It prints to STDOUT only — it writes nothing to disk and commits nothing,
#   so secrets never land in git. Copy the output straight into Railway.
#
# USAGE
#   ./scripts/gen-trainer-keys.sh op-ruben op-britney
#   ./scripts/gen-trainer-keys.sh            # defaults to the two trainers
#
set -euo pipefail

if ! command -v openssl >/dev/null 2>&1; then
  echo "error: openssl not found on PATH" >&2
  exit 1
fi

# Default to the two trainer operator ids if none supplied.
ops=("$@")
if [ "${#ops[@]}" -eq 0 ]; then
  ops=("op-ruben" "op-britney")
fi

# Build the JSON map operatorId -> key. Keys are prefixed k_live_ purely as a
# human-readable hint (the matcher in env.ts is exact-equality, prefix-agnostic).
json="{"
first=1
for op in "${ops[@]}"; do
  key="k_live_$(openssl rand -hex 32)"
  if [ "$first" -eq 0 ]; then json+=","; fi
  json+="\"$op\":\"$key\""
  first=0
done
json+="}"

oauth_secret="$(openssl rand -hex 64)"

cat <<EOF

  ──────────────────────────────────────────────────────────────────────
  FRESH TRAINER KEYS — paste into Railway, then discard this output.
  Set the SAME OPERATOR_API_KEYS on BOTH services (guns-up-app + the MCP).
  ──────────────────────────────────────────────────────────────────────

  OPERATOR_API_KEYS=$json

  # MCP service only (signs OAuth access/refresh/code JWTs):
  OAUTH_JWT_SECRET=$oauth_secret

  Next steps (see mcp-server/TRAINER_KEYS_AUDIT.md §"Provision"):
    1. Railway → guns-up-app  → Variables → set OPERATOR_API_KEYS (above)
    2. Railway → gunnyai-trainer-mcp → Variables → set the SAME
       OPERATOR_API_KEYS  + OAUTH_JWT_SECRET
    3. Redeploy both. No DB migration, no code change.
    4. Each trainer connects Claude.ai and pastes THEIR key once on /authorize.

EOF
