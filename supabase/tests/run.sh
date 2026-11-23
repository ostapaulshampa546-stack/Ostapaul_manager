#!/usr/bin/env bash
# Exécute les migrations + tests SQL sur un Postgres local jetable.
# Usage : PGHOST=/var/tmp/pgtest PGPORT=54329 ./supabase/tests/run.sh
set -eo pipefail
cd "$(dirname "$0")/../.."
DB=${TEST_DB:-ostapaul_test}
export PGUSER=${PGUSER:-postgres}
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" > /dev/null; echo "  ok  $1"; }
run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
status=0
for f in supabase/tests/[1-9]*.sql; do
  echo "== $f"
  if ! psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" 2>&1 | sed -E 's/^psql:[^:]+:[0-9]+: //' | grep -E "PASS|FAIL|ERROR|ALL TESTS" ; then :; fi
  psql -X -q -t -d "$DB" -c "select 1" >/dev/null
done
