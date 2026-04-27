#!/bin/bash
set -e

# Generate Prisma client (needs a DATABASE_URL, even a dummy one)
export DATABASE_URL="${DATABASE_URL:-postgresql://dummy:dummy@localhost:5432/dummy}"
npx prisma generate

# NOTE: prisma db push is intentionally NOT run at build time.
#
# On Railway, Postgres is only reachable via its internal hostname (e.g.
# postgres-XXXX.railway.internal) at RUNTIME — during the build phase
# the internal network isn't connected, so `prisma db push` errors with
# P1001 ("Can't reach database server"). We previously masked that with
# warn-and-continue, which led to schema drift and the lockout incident.
#
# The schema sync now runs in scripts/start.sh, which fires when the
# container boots and the internal DB hostname resolves. If you need
# the build to push directly (rare — e.g. to test a public DATABASE_URL),
# set FORCE_BUILD_DB_PUSH=1.
if [ "$FORCE_BUILD_DB_PUSH" = "1" ]; then
  echo "FORCE_BUILD_DB_PUSH=1 — running prisma db push during build..."
  if ! npx prisma db push --accept-data-loss; then
    echo "ERROR: forced prisma db push failed during build." >&2
    exit 1
  fi
else
  echo "Skipping prisma db push during build (runs at startup via scripts/start.sh)"
fi

# Inject build timestamp into service worker for cache busting
BUILD_TS=$(date +%s)
echo "Injecting build version: $BUILD_TS into sw.js"
sed -i "s/__BUILD_TIMESTAMP__/$BUILD_TS/g" public/sw.js

# Build Next.js
npx next build
