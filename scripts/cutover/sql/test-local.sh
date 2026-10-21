#!/bin/bash
# MEDIA-08 local proof driver (plan 03-05 Task 2). LOCAL STACK ONLY.
#
#   scripts/cutover/sql/test-local.sh [log-file]
#
# Runs scripts/cutover/sql/test-local.sql inside the local Supabase container
# supabase_db_Clickit (one rolled-back transaction) under the shared heavy lock,
# through scripts/cutover/with-heavy-lock.sh. Default log:
#   /Users/koss/.clickit-checks/p3-exec/p3-sql-test.log  (last line exit=<status>)
# Detached:
#   perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' caffeinate -i -s -m \
#     scripts/cutover/sql/test-local.sh
#
# It never starts, stops or resets a stack: if supabase_db_Clickit is not
# running it prints "local stack down: start it under the lock" and exits 2.
set -u

CONTAINER=supabase_db_Clickit
DEST=/tmp/clickit-cutover-sql
SQL_DIR=$(cd "$(dirname "$0")" && pwd -P)
REPO=$(cd "$SQL_DIR/../../.." && pwd -P)

if [ "${1:-}" != "--inner" ]; then
  LOG=${1:-/Users/koss/.clickit-checks/p3-exec/p3-sql-test.log}
  exec "$REPO/scripts/cutover/with-heavy-lock.sh" "$LOG" -- "$SQL_DIR/test-local.sh" --inner
fi

# ---- inner body: runs while with-heavy-lock.sh holds the lock

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "local stack down: start it under the lock"
  exit 2
fi

shopt -s nullglob
MIGRATIONS=("$REPO"/supabase/migrations/*_media_url_rewrite_backup.sql)
if [ "${#MIGRATIONS[@]}" -ne 1 ]; then
  echo "expected exactly one *_media_url_rewrite_backup.sql migration, found ${#MIGRATIONS[@]}"
  exit 3
fi

echo "repo=$REPO head=$(git -C "$REPO" rev-parse --short HEAD) migration=$(basename "${MIGRATIONS[0]}")"

# Fresh copy of the SQL inside the container (a temp folder this script owns).
docker exec "$CONTAINER" rm -rf "$DEST" || exit 4
docker exec "$CONTAINER" mkdir -p "$DEST" || exit 4
for f in "$SQL_DIR"/*.sql; do
  docker cp "$f" "$CONTAINER:$DEST/$(basename "$f")" >/dev/null || exit 4
done
docker cp "${MIGRATIONS[0]}" "$CONTAINER:$DEST/migration_media_url_rewrite_backup.sql" >/dev/null || exit 4

regclass_q="select coalesce(to_regclass('private.media_url_rewrite_backup')::text, '')"
before=$(docker exec -i "$CONTAINER" psql -U postgres -tAc "$regclass_q")
echo "before_backup_table=[$before]"

docker exec -i "$CONTAINER" psql -U postgres -v ON_ERROR_STOP=1 -f "$DEST/test-local.sql"
status=$?
echo "psql_status=$status"

# Read-only check after the rollback: the stack is as before (no backup table
# left behind when there was none).
after=$(docker exec -i "$CONTAINER" psql -U postgres -tAc "$regclass_q")
echo "after_rollback_backup_table=[$after]"
if [ "$status" -eq 0 ] && [ "$after" != "$before" ]; then
  echo "backup table state changed by the test: before=[$before] after=[$after]"
  status=5
fi

docker exec "$CONTAINER" rm -rf "$DEST" >/dev/null 2>&1
exit "$status"
