#!/bin/bash
set -e

# Container startup script for Railway / any Docker host.
#
# Why this exists: On Railway, the Postgres service is only reachable
# via its internal hostname (e.g. postgres-XXXX.railway.internal) at
# RUNTIME — during the build phase the internal network isn't connected,
# so `prisma db push` errors with P1001 ("Can't reach database server").
# We sync the schema HERE, where the DB is actually reachable, before
# Next.js starts serving requests.
#
# If `prisma db push` fails at startup, we hard-fail the container so
# Railway shows the deploy as broken. That's the right behavior — better
# a visible failed deploy than silent schema drift that 500s every
# Operator query and locks users out.
#
# Override (rare): SKIP_DB_PUSH=1 to skip the push (e.g. read-only DB).

if [ "$SKIP_DB_PUSH" = "1" ]; then
  echo "[start.sh] SKIP_DB_PUSH=1 — skipping prisma db push"
elif [ -z "$DATABASE_URL" ]; then
  echo "[start.sh] DATABASE_URL not set — skipping prisma db push"
elif echo "$DATABASE_URL" | grep -q "dummy"; then
  echo "[start.sh] DATABASE_URL is the dummy build-time placeholder — skipping push"
else
  echo "[start.sh] DATABASE_URL detected, syncing schema..."
  if ! npx prisma db push --accept-data-loss; then
    echo "[start.sh] ERROR: prisma db push failed. Refusing to start with stale schema." >&2
    echo "[start.sh] If this is intentional (e.g. read-only replica), set SKIP_DB_PUSH=1." >&2
    exit 1
  fi
  echo "[start.sh] Schema synced successfully."
fi

# Hand off to Next.js
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
