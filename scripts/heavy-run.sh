#!/bin/bash
# Run one heavy command (build, gate:local, Playwright, db work) under the shared
# Clickit heavy lock and end the log with an `exit=<rc>` line.
#   bash scripts/heavy-run.sh <command...>
# Launch detached (see supabase/tests/README.md "Heavy steps"); the log lives in
# /Users/koss/.clickit-checks/, never /tmp.
set -u

LOCK=/Users/koss/.clickit-heavy.lock
TOOK=0
rc=0

cleanup() {
  rc=${rc_cmd:-$?}
  if [ "$TOOK" = 1 ] && [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$$" ]; then
    rm -rf "$LOCK"
  fi
  if [ "$TOOK" = 1 ]; then echo "ended=$(date -u +%FT%TZ)"; fi
  echo "exit=$rc"
}
trap cleanup EXIT

if [ "$#" -eq 0 ]; then
  echo "heavy-run: no command given"
  rc_cmd=2
  exit 2
fi

if ! mkdir "$LOCK" 2>/dev/null; then
  holder=$(cat "$LOCK/pid" 2>/dev/null || true)
  if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then
    # stale lock: the holder is gone
    rm -rf "$LOCK"
    mkdir "$LOCK" 2>/dev/null || { echo "heavy-run: lock held by unknown"; rc_cmd=75; exit 75; }
  else
    echo "heavy-run: lock held by ${holder:-unknown}"
    rc_cmd=75
    exit 75
  fi
fi
echo $$ > "$LOCK/pid"
TOOK=1
export CLICKIT_HEAVY_LOCK_HELD=1

echo "started=$(date -u +%FT%TZ)"
echo "command=$*"
"$@"
rc_cmd=$?
exit "$rc_cmd"
