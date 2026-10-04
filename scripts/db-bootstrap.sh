#!/usr/bin/env bash
# One-time local setup: database + a non-superuser application role.
#
# Why a separate role matters (not optional): the default local Postgres
# role created by Homebrew is a SUPERUSER with BYPASSRLS. Postgres row-level
# security policies are silently skipped for superusers and the BYPASSRLS
# attribute, regardless of ENABLE/FORCE ROW LEVEL SECURITY. If the app (or
# the isolation test) connected as that role, every RLS policy in
# migrations/*.sql would be structurally inert — queries would see every
# user's rows and the isolation test would pass for the wrong reason, or
# fail in a way that looks like a policy bug when it's actually a role bug.
# See docs/adr/ADR-004-row-level-security.md's Phase 3 implementation note.
#
# Idempotent: safe to re-run.
set -euo pipefail

DB_NAME="${TASKMASTER_DB_NAME:-taskmaster_dev}"
APP_ROLE="${TASKMASTER_APP_ROLE:-taskmaster_app}"
APP_PASSWORD="${TASKMASTER_APP_PASSWORD:-taskmaster_app_local_dev}"

echo "Ensuring database '$DB_NAME' exists..."
psql postgres -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 \
  || createdb "$DB_NAME"

echo "Ensuring role '$APP_ROLE' exists (non-superuser, no BYPASSRLS)..."
psql postgres -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$APP_ROLE') THEN
    CREATE ROLE $APP_ROLE WITH LOGIN PASSWORD '$APP_PASSWORD' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
  END IF;
END
\$\$;
SQL

echo "Granting CONNECT on '$DB_NAME' to '$APP_ROLE'..."
psql postgres -v ON_ERROR_STOP=1 -c "GRANT CONNECT ON DATABASE $DB_NAME TO $APP_ROLE;"

echo "Granting schema/table privileges on '$DB_NAME' to '$APP_ROLE'..."
psql "$DB_NAME" -v ON_ERROR_STOP=1 <<SQL
GRANT USAGE ON SCHEMA public TO $APP_ROLE;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO $APP_ROLE;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO $APP_ROLE;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO $APP_ROLE;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO $APP_ROLE;
SQL

echo "Done. Add to .env.local:"
echo "  DATABASE_URL=postgresql://$(whoami)@localhost:5432/$DB_NAME"
echo "  DATABASE_URL_APP=postgresql://$APP_ROLE:$APP_PASSWORD@localhost:5432/$DB_NAME"
