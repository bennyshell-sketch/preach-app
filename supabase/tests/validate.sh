#!/usr/bin/env bash
# Apply every migration to a throwaway Postgres to prove the schema builds.
#
# This is a syntax/dependency/policy-expression check, not a substitute for
# `supabase db reset` against a real project — pgvector's typmod and the ivfflat
# access method cannot be emulated, so those two constructs are rewritten below.
set -euo pipefail

PORT="${PGPORT:-55432}"
HOST="${PGHOST:-/tmp}"
DB="preach_validate_$$"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

psql -h "$HOST" -p "$PORT" -U postgres -q -c "drop database if exists $DB;"
psql -h "$HOST" -p "$PORT" -U postgres -q -c "create database $DB;"
trap 'psql -h "$HOST" -p "$PORT" -U postgres -q -c "drop database if exists $DB;" >/dev/null 2>&1 || true' EXIT

run() { psql -h "$HOST" -p "$PORT" -U postgres -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }

run -f "$ROOT/supabase/tests/shim.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "── $(basename "$f")"
  sed -E \
    -e '/create extension if not exists "(vector|pg_net)"/d' \
    -e 's/extensions\.vector\(1536\)/extensions.vector/g' \
    -e '/create index verse_embeddings_ivfflat_idx/,/with \(lists = [0-9]+\);/c\
create index verse_embeddings_ivfflat_idx on public.verse_search_embeddings (ref);' \
    "$f" > "/tmp/$(basename "$f").validate"
  run -f "/tmp/$(basename "$f").validate"
done

if [[ "${1:-}" == "--with-tests" ]]; then
  echo
  echo "── RLS behaviour tests"
  # Tests must run as a non-superuser: superusers bypass RLS entirely, which
  # would make every assertion pass vacuously.
  run -c "drop role if exists rls_tester;" >/dev/null 2>&1 || true
  run -c "create role rls_tester login noinherit;"
  run -c "grant authenticated to rls_tester;"
  run -c "grant usage on schema public, extensions, auth, storage to rls_tester, authenticated;"
  # The test file defines its own assert()/act_as() helpers.
  run -c "grant create on schema public to rls_tester;"
  run -c "grant all on all tables in schema public to authenticated;"
  run -c "grant all on all sequences in schema public to authenticated;"
  run -c "grant execute on all functions in schema public to authenticated;"
  run -c "grant select, insert on auth.users to authenticated;"
  # Healing circles are curated content with no INSERT policy by design, so the
  # fixtures are seeded here with service-role reach, as the app's seed does.
  run -c "insert into public.healing_circles (topic) values ('Grief & Loss'), ('Anxiety & Fear');"
  PGPASSWORD= psql -h "$HOST" -p "$PORT" -U rls_tester -d "$DB" -v ON_ERROR_STOP=1 -q \
    -f "$ROOT/supabase/tests/rls_test.sql"
fi

echo
echo "── object counts"
run -c "select
    (select count(*) from pg_tables where schemaname='public') as tables,
    (select count(*) from pg_policies where schemaname='public') as policies,
    (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public') as functions,
    (select count(*) from pg_trigger where not tgisinternal) as triggers;"

echo
echo "✓ all migrations applied cleanly"
