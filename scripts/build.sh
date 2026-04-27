#!/bin/bash
set -e

# Generate Prisma client (needs a DATABASE_URL, even a dummy one)
export DATABASE_URL="${DATABASE_URL:-postgresql://dummy:dummy@localhost:5432/dummy}"
npx prisma generate

# Push schema to database if a real DATABASE_URL was provided.
#
# We INTENTIONALLY hard-fail the build if `prisma db push` fails when a
# real DATABASE_URL is present. The previous warn-and-continue behavior
# once deployed an app with stale schema — the runtime Prisma client
# expected columns that didn't exist, every Operator query 500'd, and
# the LoginScreen fell back to the static OPERATORS array (locking the
# real user out with a default PIN that "worked" but issued no JWT).
# Better to fail the build than ship that.
#
# Override (rare): SKIP_DB_PUSH=1 to skip the push intentionally.
if [ "$SKIP_DB_PUSH" = "1" ]; then
  echo "SKIP_DB_PUSH=1 — skipping prisma db push by request"
elif [ -n "$REAL_DB" ] || echo "$DATABASE_URL" | grep -qv "dummy"; then
  echo "DATABASE_URL detected, pushing schema..."
  if ! npx prisma db push --accept-data-loss; then
    echo "ERROR: prisma db push failed. Failing the build to avoid shipping stale schema." >&2
    echo "If this is intentional (read-only DB, etc.), set SKIP_DB_PUSH=1." >&2
    exit 1
  fi
else
  echo "No real DATABASE_URL, skipping db push"
fi

# Inject build timestamp into service worker for cache busting
BUILD_TS=$(date +%s)
echo "Injecting build version: $BUILD_TS into sw.js"
sed -i "s/__BUILD_TIMESTAMP__/$BUILD_TS/g" public/sw.js

# Build Next.js
npx next build
