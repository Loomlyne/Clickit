#!/usr/bin/env bash
# Heavy-step runner for phase 02.1 (npm ci, next build, cf:build, preview,
# gate:local, anything touching the shared local Supabase stack's schema).
#
#   scripts/cf/heavy.sh <log-name> <command...>
#
# - Takes the machine-wide lock /Users/koss/.clickit-heavy.lock (mkdir loop,
#   15 s between tries, writes its PID to lock/pid). After 60 min of waiting it
#   writes `exit=lock-timeout` and stops; it never removes someone else's lock.
# - Runs the command under `caffeinate -i -s -m`, stdout and stderr to
#   /Users/koss/clickit-phase021-logs/<log-name>.log (a fresh log per run),
#   and appends a final line `exit=<code>`.
# - Removes only its own lock on exit. Never prints env values (the log header
#   names the program only, not its arguments or environment).
#
# Detached launch (macOS has no setsid binary; a harness background shell is
# cancelled by a session restart):
#   caffeinate -i -s -m perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' \
#     scripts/cf/heavy.sh <name> <cmd...> >/dev/null 2>&1 &
# or without the outer caffeinate:
#   perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' scripts/cf/heavy.sh <name> <cmd...> >/dev/null 2>&1 &
# Then wait until `tail -1 <log>` starts with `exit=`.

set -u

LOG_DIR=/Users/koss/clickit-phase021-logs
LOCK=/Users/koss/.clickit-heavy.lock
WAIT_LIMIT_S=3600
WAIT_STEP_S=15

if [ "$#" -lt 2 ]; then
  echo "usage: scripts/cf/heavy.sh <log-name> <command...>" >&2
  exit 2
fi
NAME=$1
shift
case "$NAME" in
  '' | *[!A-Za-z0-9._-]* | .*)
    echo "heavy.sh: log name must be [A-Za-z0-9._-] and not start with a dot" >&2
    exit 2
    ;;
esac

mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/$NAME.log"
: >"$LOG"
echo "heavy.sh start=$(date -u +%Y-%m-%dT%H:%M:%SZ) pid=$$ program=$(basename -- "$1")" >>"$LOG"

waited=0
until mkdir "$LOCK" 2>/dev/null; do
  if [ "$waited" -ge "$WAIT_LIMIT_S" ]; then
    echo "heavy.sh: lock still held after ${WAIT_LIMIT_S}s (holder pid $(cat "$LOCK/pid" 2>/dev/null || echo unknown)); not removing it" >>"$LOG"
    echo "exit=lock-timeout" >>"$LOG"
    exit 75
  fi
  sleep "$WAIT_STEP_S"
  waited=$((waited + WAIT_STEP_S))
done
echo "$$" >"$LOCK/pid"
echo "heavy.sh lock acquired after ${waited}s at $(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$LOG"

release_lock() {
  if [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$$" ]; then
    rm -rf "$LOCK"
  fi
}
trap release_lock EXIT
trap 'echo "exit=interrupted" >>"$LOG"; exit 130' INT TERM HUP

caffeinate -i -s -m "$@" >>"$LOG" 2>&1
code=$?
release_lock
echo "heavy.sh end=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$LOG"
echo "exit=$code" >>"$LOG"
exit "$code"
