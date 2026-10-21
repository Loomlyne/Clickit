#!/bin/bash
# Scratch-database proof harness for Phase 5 SQL changes.
#
# Builds a scratch database (p5_proof_<pid>) inside the local stack container
# supabase_db_Clickit, applies every supabase/migrations file and the seed, runs
# supabase/tests/0*.sql and m*.sql, then supabase/pending/*.sql and
# supabase/tests/pending_*.sql. supabase/tests/pre_*.sql fixtures run once,
# just before the first migration whose name contains _phase5_ (or, when there
# is none, before supabase/pending). The shared `postgres` database is only read
# (fingerprinted before and after) and the scratch database is always dropped.
#
#   bash scripts/db-proof.sh [--only <glob>] [--types-out <path>]
#
# Launch detached; the log ends with `exit=<rc>` (see supabase/tests/README.md).
set -u

LOCK=/Users/koss/.clickit-heavy.lock
C=supabase_db_Clickit
DB="p5_proof_$$"
OUT_DIR=/Users/koss/.clickit-checks
LAST="$OUT_DIR/p5-db-proof-last.out"
TOOK=0
FAIL=0
STARTED=0
ONLY=""
TYPES_OUT=""

ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || { echo "db-proof: not inside a git checkout"; echo "exit=2"; exit 2; }

while [ "$#" -gt 0 ]; do
  case "$1" in
    --only) ONLY="${2:-}"; shift 2 ;;
    --types-out) TYPES_OUT="${2:-}"; shift 2 ;;
    *) echo "db-proof: unknown argument $1"; echo "exit=2"; exit 2 ;;
  esac
done

FP_Q="select (select count(*) from supabase_migrations.schema_migrations)||'|'||(select count(*) from public.shows)||'|'||(select count(*) from auth.users)"
BEFORE=""

cleanup() {
  rc=$?
  [ "$FAIL" != 0 ] && rc=1
  if [ "$STARTED" = 1 ]; then
    docker exec "$C" psql -U supabase_admin -d postgres -At -c "drop database if exists \"$DB\" with (force)" >/dev/null 2>&1
    left=$(docker exec "$C" psql -U postgres -d postgres -At -c "select count(*) from pg_database where datname like 'p5\\_proof\\_%'" 2>&1)
    echo "scratch_db_left=$left"
    [ "$left" = 0 ] || rc=1
    AFTER=$(docker exec "$C" psql -U postgres -d postgres -At -c "$FP_Q" 2>&1)
    if [ -n "$BEFORE" ] && [ "$BEFORE" = "$AFTER" ]; then
      echo "shared_db_unchanged=yes"
    else
      echo "shared_db_unchanged=no before=$BEFORE after=$AFTER"
      rc=1
    fi
  fi
  if [ "$TOOK" = 1 ] && [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$$" ]; then
    rm -rf "$LOCK"
    echo "lock_released=1"
  fi
  echo "exit=$rc"
}
trap cleanup EXIT

# --- stack present?
if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$C"; then
  echo "db-proof: $C not running"
  exit 2
fi
others=$(docker ps --format '{{.Names}}' | grep '^supabase_db_' | grep -vx "$C" | paste -sd, -)
echo "other_stacks=${others:-none}"

# --- heavy lock (skipped when heavy-run.sh already holds it)
if [ "${CLICKIT_HEAVY_LOCK_HELD:-}" != 1 ]; then
  until mkdir "$LOCK" 2>/dev/null; do
    holder=$(cat "$LOCK/pid" 2>/dev/null || true)
    if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then rm -rf "$LOCK"; continue; fi
    sleep 20
  done
  echo $$ > "$LOCK/pid"
  TOOK=1
fi

cd "$ROOT" || exit 1
mkdir -p "$OUT_DIR"
echo "start=$(date -u +%FT%TZ)"
echo "root=$ROOT"

BEFORE=$(docker exec "$C" psql -U postgres -d postgres -At -c "$FP_Q" 2>&1)
echo "before=$BEFORE"
STARTED=1

# Any p5_proof_* database is stale here: we hold the lock, so no other proof is running.
stale=$(docker exec "$C" psql -U supabase_admin -d postgres -At -c "select datname from pg_database where datname like 'p5\\_proof\\_%'")
for s in $stale; do
  docker exec "$C" psql -U supabase_admin -d postgres -At -c "drop database if exists \"$s\" with (force)" >/dev/null 2>&1
  echo "stale_dropped=$s"
done

docker exec "$C" psql -U supabase_admin -d postgres -At -c "create database \"$DB\" owner postgres" || { FAIL=1; exit 1; }

echo "--- bootstrap (read-only schema dump of shared DB)"
docker exec "$C" pg_dump -U supabase_admin --schema-only --schema=auth --schema=storage --schema=extensions postgres \
  | docker exec -i "$C" psql -U supabase_admin -d "$DB" 2>&1 | grep -iE 'error|fatal' | head -20

echo "--- strip policies and triggers copied onto managed schemas (scratch DB only)"
docker exec -i "$C" psql -U supabase_admin -d "$DB" -v ON_ERROR_STOP=1 <<'SQL' || { FAIL=1; exit 1; }
do $$
declare r record;
begin
  for r in select schemaname, tablename, policyname from pg_policies where schemaname in ('auth','storage','extensions') loop
    execute format('drop policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
  for r in select n.nspname, c.relname, t.tgname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
           where not t.tgisinternal and n.nspname in ('auth','storage','extensions') loop
    execute format('drop trigger %I on %I.%I', r.tgname, r.nspname, r.relname);
  end loop;
end $$;
SQL

docker exec "$C" psql -U supabase_admin -d "$DB" -v ON_ERROR_STOP=1 -c "create publication supabase_realtime" || { FAIL=1; exit 1; }
# Default privileges are per-database; a fresh database has none, so anon and authenticated
# would get "permission denied" on every migrated table. Mirror what the local stack sets.
docker exec -i "$C" psql -U supabase_admin -d "$DB" -v ON_ERROR_STOP=1 <<'SQL' || { FAIL=1; exit 1; }
grant usage on schema public to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema storage grant all on tables to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema storage grant all on functions to postgres, anon, authenticated, service_role;
alter default privileges for role postgres in schema storage grant all on sequences to postgres, anon, authenticated, service_role;
SQL
# Extensions that live outside the dumped schemas (the YouTube migration needs Vault).
docker exec "$C" psql -U supabase_admin -d "$DB" -v ON_ERROR_STOP=1 -c "create extension if not exists supabase_vault cascade" || { FAIL=1; exit 1; }
docker exec "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 -c "create schema if not exists supabase_migrations; create table supabase_migrations.schema_migrations (version text primary key, name text)" || { FAIL=1; exit 1; }

# apply_sql <file> : single transaction as postgres; on failure print tail and fail
apply_sql() {
  if docker exec -i "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 --single-transaction -q < "$1" > "$LAST" 2>&1; then
    return 0
  fi
  echo "FAILED $1"; tail -15 "$LAST"; FAIL=1; return 1
}

# run_tests <glob-pattern-list...> : run test files in name order, print ok <name>
run_tests() {
  local list f b
  list=$(for p in "$@"; do ls supabase/tests/$p 2>/dev/null; done | sort -u)
  for f in $list; do
    b=$(basename "$f" .sql)
    if [ -n "$ONLY" ]; then
      case "$b" in $ONLY|$ONLY.sql) ;; *) continue ;; esac
    fi
    if docker exec -i "$C" psql -U postgres -d "$DB" -v ON_ERROR_STOP=1 --single-transaction -q < "$f" > "$LAST" 2>&1; then
      echo "ok $b"
    else
      echo "FAIL $b"; tail -15 "$LAST"; FAIL=1; exit 1
    fi
  done
}

# run_pre_fixtures : apply supabase/tests/pre_*.sql once, in name order
PRE_DONE=0
run_pre_fixtures() {
  local f pre=0
  [ "$PRE_DONE" = 1 ] && return 0
  echo "--- pre fixtures"
  for f in $(ls supabase/tests/pre_*.sql 2>/dev/null | sort); do
    apply_sql "$f" || return 1
    pre=$((pre + 1))
  done
  PRE_DONE=1
  echo "pre_fixtures=$pre"
}

echo "--- migrations"
for f in supabase/migrations/*.sql; do
  b=$(basename "$f" .sql); v=${b%%_*}; n=${b#*_}
  # Fixtures describe the database as it stands before Phase 5 (for example an
  # app_config row pointing at an account), so they run just before the first
  # _phase5_ migration.
  case "$b" in *_phase5_*) run_pre_fixtures || exit 1 ;; esac
  apply_sql "$f" || exit 1
  docker exec "$C" psql -U postgres -d "$DB" -q -c "insert into supabase_migrations.schema_migrations values ('$v','$n')" >/dev/null
done
echo "migrations_applied=ok"

apply_sql supabase/seed.sql || exit 1
echo "seed=ok"

echo "--- tests"
run_tests '0*.sql' 'm*.sql'

# Without a _phase5_ migration the fixtures still run once, before pending migrations.
run_pre_fixtures || exit 1

echo "--- pending migrations"
pend=0
for f in $(ls supabase/pending/*.sql 2>/dev/null | sort); do
  apply_sql "$f" || exit 1
  pend=$((pend + 1))
done
echo "pending_applied=$pend"
if [ "$pend" -gt 0 ]; then
  run_tests 'pending_*.sql'
fi

if [ -n "$TYPES_OUT" ]; then
  port=$(awk '/^\[db\]/{s=1;next} /^\[/{s=0} s && /^port *=/{gsub(/[^0-9]/,"",$0); print $0; exit}' supabase/config.toml)
  tmp="$TYPES_OUT.tmp"
  if [ -n "$port" ] && supabase gen types typescript --db-url "postgresql://postgres:postgres@127.0.0.1:$port/$DB" --schema public > "$tmp" 2> "$LAST" && [ -s "$tmp" ]; then
    mv "$tmp" "$TYPES_OUT"
    echo "types_written=$TYPES_OUT"
  else
    rm -f "$tmp"
    tail -5 "$LAST"
    echo "types_written=no"
  fi
fi
