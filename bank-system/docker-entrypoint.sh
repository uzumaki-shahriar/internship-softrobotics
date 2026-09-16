#!/bin/sh
set -e

echo "Applying migrations..."
npx prisma migrate deploy

echo "Seeding (idempotent)..."
node prisma/seed.js

exec "$@"
