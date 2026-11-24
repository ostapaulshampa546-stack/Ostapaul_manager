#!/usr/bin/env bash
# Migrations + tests SQL sur un Postgres local jetable.
# Usage : PGHOST=/tmp/pg PGPORT=54329 npm run test:db
set -eo pipefail
cd "$(dirname "$0")/../.."
DB=${TEST_DB:-afrilearn_test}
export PGUSER=${PGUSER:-postgres}
psql -q -d postgres -c "drop database if exists $DB" -c "create database $DB"
run() { psql -q -v ON_ERROR_STOP=1 -d "$DB" -f "$1" > /dev/null; echo "  ok  $1"; }
run supabase/tests/00_supabase_stub.sql
for f in supabase/migrations/*.sql; do run "$f"; done
fail=0
for f in supabase/tests/[1-9]*.sql; do
  echo "== $f"
  out=$(psql -X -q -v ON_ERROR_STOP=1 -d "$DB" -f "$f" 2>&1) || fail=1
  echo "$out" | sed -E 's/^psql:[^:]+:[0-9]+: //' | grep -E "PASS|FAIL|ERROR|PASSED" || true
done
if [ $fail -ne 0 ]; then echo "SQL TESTS FAILED"; exit 1; fi
echo "ALL SQL TESTS PASSED"
