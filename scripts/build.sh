#!/bin/bash
set -e

# Generate Prisma client (needs a DATABASE_URL, even a dummy one)
export DATABASE_URL="${DATABASE_URL:-postgresql://dummy:dummy@localhost:5432/dummy}"
npx prisma generate

# Push schema to database if a real DATABASE_URL was provided
if [ -n "$REAL_DB" ] || echo "$DATABASE_URL" | grep -qv "dummy"; then
  echo "DATABASE_URL detected, pushing schema..."
  npx prisma db push --skip-generate --accept-data-loss || echo "WARNING: db push failed, continuing build"
else
  echo "No real DATABASE_URL, skipping db push"
fi

# Build Next.js
npx next build
