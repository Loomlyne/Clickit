#!/bin/bash
# Run one heavy local step under the shared Clickit heavy lock.
#
#   scripts/cutover/with-heavy-lock.sh <log-file> -- <command> [args...]
#
# - Waits for /Users/koss/.clickit-heavy.lock (mkdir lock, as the Phase 1 gate
#   scripts do), writes its PID into <lock>/pid and removes the lock on exit
#   only while that pid file still names this process. A lock held by anyone
#   else is never broken: this script waits.
# - Appends start=<UTC>, the command's stdout and stderr, end=<UTC> and, as the
#   last line, exit=<status> to <log-file>.
# - Refuses a log path inside the repository (logs stay outside the repo:
#   /Users/koss/.clickit-checks/...).
#
# Used by scripts/cutover/sql/test-local.sh and by the cutover runbook for
# r2:media (Steps 14-15). Run it detached for long steps:
#   perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' caffeinate -i -s -m \
#     scripts/cutover/with-heavy-lock.sh /Users/koss/.clickit-checks/p3-exec/x.log -- npm run r2:media
set -u

LOCK=/Users/koss/.clickit-heavy.lock

usage() {
  echo "usage: with-heavy-lock.sh <log-file> -- <command> [args...]" >&2
  exit 64
}

[ $# -ge 3 ] || usage
LOG=$1
shift
[ "$1" = "--" ] || usage
shift
[ $# -ge 1 ] || usage

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd -P)
REPO_TOP=$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel 2>/dev/null || true)
COMMON_DIR=$(git -C "$SCRIPT_DIR" rev-parse --path-format=absolute --git-common-dir 2>/dev/null || true)
MAIN_TOP=""
[ -n "$COMMON_DIR" ] && MAIN_TOP=$(cd "$COMMON_DIR/.." 2>/dev/null && pwd -P)
[ -n "$REPO_TOP" ] && REPO_TOP=$(cd "$REPO_TOP" && pwd -P)

LOG_DIR=$(dirname "$LOG")
if ! mkdir -p "$LOG_DIR" 2>/dev/null; then
  echo "with-heavy-lock: cannot create log directory $LOG_DIR" >&2
  exit 64
fi
LOG_DIR_ABS=$(cd "$LOG_DIR" && pwd -P)
LOG_ABS="$LOG_DIR_ABS/$(basename "$LOG")"

inside() {
  local root=$1
  [ -n "$root" ] || return 1
  case "$LOG_ABS" in
    "$root"/*) return 0 ;;
  esac
  return 1
}

if inside "$REPO_TOP" || inside "$MAIN_TOP" || inside "$(pwd -P)/.git"; then
  echo "with-heavy-lock: refusing log path inside the repository: $LOG_ABS" >&2
  echo "with-heavy-lock: write logs under /Users/koss/.clickit-checks/ instead" >&2
  exit 64
fi

stamp() { date -u +%Y-%m-%dT%H:%M:%SZ; }

waited=0
until mkdir "$LOCK" 2>/dev/null; do
  if [ "$waited" -eq 0 ]; then
    holder=$(cat "$LOCK/pid" 2>/dev/null || echo unknown)
    echo "waiting=$(stamp) lock=$LOCK holder_pid=$holder" >>"$LOG_ABS"
    waited=1
  fi
  sleep 20
done
echo $$ >"$LOCK/pid"

release() {
  if [ "$(cat "$LOCK/pid" 2>/dev/null)" = "$$" ]; then
    rm -rf "$LOCK"
  fi
}
trap release EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "start=$(stamp) pid=$$ cmd=$*" >>"$LOG_ABS"
"$@" >>"$LOG_ABS" 2>&1
status=$?
echo "end=$(stamp)" >>"$LOG_ABS"
echo "exit=$status" >>"$LOG_ABS"
echo "exit=$status"
exit "$status"
