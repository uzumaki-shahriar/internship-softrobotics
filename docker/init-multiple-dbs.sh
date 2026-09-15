#!/bin/bash
# Runs once, only when the postgres data volume is first created. Creates
# one database per app/instance that wants to use this shared local Postgres
# server - each app is still a fully separate codebase/deployment, this is
# just a convenience so you don't need N separate Postgres server processes
# running locally. Add a name to POSTGRES_MULTIPLE_DATABASES (comma-
# separated) in docker-compose.yml for every bank instance / app you add.
set -e

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
  echo "Creating databases: $POSTGRES_MULTIPLE_DATABASES"
  for db in $(echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' '); do
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
      CREATE DATABASE "$db";
EOSQL
  done
fi
