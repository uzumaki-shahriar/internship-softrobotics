#!/bin/sh
set -e

echo "Applying migrations..."
alembic upgrade head

echo "Seeding (idempotent)..."
python -m app.seed

exec "$@"
