#!/bin/bash
# Runs once, only when the postgres data volume is first created. Creates
# one database per system so each keeps its own schema on this shared
# Postgres server - lighter for local dev than a separate server per system,
# while still keeping the databases themselves fully isolated.
set -e

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
  echo "Creating databases: $POSTGRES_MULTIPLE_DATABASES"
  for db in $(echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' '); do
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
      CREATE DATABASE "$db";
EOSQL
  done
fi
