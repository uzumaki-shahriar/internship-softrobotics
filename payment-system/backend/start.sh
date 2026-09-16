#!/usr/bin/env bash
set -e

echo "Waiting for database to be available..."
until python - <<'PY'
import sys, time
import sqlalchemy
from sqlalchemy import create_engine
from os import getenv
url = getenv('DATABASE_URL')
if not url:
    print('DATABASE_URL not set', file=sys.stderr)
    sys.exit(1)
for i in range(60):
    try:
        engine = create_engine(url)
        conn = engine.connect()
        conn.close()
        print('Database available')
        sys.exit(0)
    except Exception as e:
        time.sleep(1)
print('Timed out waiting for database', file=sys.stderr)
sys.exit(1)
PY

echo "Running alembic upgrade head..."
alembic upgrade head

echo "Starting gateway..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
