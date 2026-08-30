#!/bin/sh
set -e
echo "Running database migrations..."
npx prisma migrate deploy --schema=packages/database/prisma/schema.prisma
echo "Starting API..."
exec node apps/api/dist/main.js
