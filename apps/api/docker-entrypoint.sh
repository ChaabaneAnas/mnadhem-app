#!/bin/sh
set -e

echo "Running database migrations..."
# Prisma 7 takes the datasource URL from prisma.config.ts, and discovers that
# file in the *current working directory* — passing --schema from the repo root
# leaves it undiscovered and migrate fails with "datasource.url is required".
# The config's own paths are relative to it, so no flags are needed here.
(cd packages/database && npx prisma migrate deploy)

echo "Starting API..."
exec node apps/api/dist/main.js
