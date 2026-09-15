#!/bin/sh
set -e

echo "Applying migrations..."
npx prisma migrate deploy

echo "Provisioning as a Payment Gateway merchant (idempotent)..."
node src/bootstrap.js

exec "$@"
