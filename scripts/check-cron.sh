#!/bin/bash
# Manually trigger the orphan-media cron endpoint and show the result.
# Reads CRON_SECRET from Vercel env (via vercel env pull) so you never
# have to paste the secret or hunt for it.
#
# Usage:  ./scripts/check-cron.sh
#
# Requires: vercel CLI authenticated, curl, jq (optional — falls back to raw JSON)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "→ Pulling latest production env vars (sensitive ones stay encrypted on Vercel)"
vercel env pull --yes --environment=production .vercel/.env.production.local >/dev/null 2>&1

# The pulled file masks sensitive values as "". We need to call Vercel's
# secret-reveal API. Simpler path: ask the user to paste on first use, cache
# locally in .vercel/.cron-secret (gitignored).

SECRET_CACHE="$ROOT/.vercel/.cron-secret"
if [ ! -f "$SECRET_CACHE" ]; then
  echo ""
  echo "  First-time setup: paste CRON_SECRET once (will be cached locally, gitignored)."
  read -rsp "  CRON_SECRET: " SECRET
  echo ""
  echo "$SECRET" > "$SECRET_CACHE"
  chmod 600 "$SECRET_CACHE"
fi
SECRET="$(cat "$SECRET_CACHE")"

ENDPOINT="https://clickit-cit.vercel.app/api/cron/cleanup-media"

echo "→ Hitting $ENDPOINT"
echo ""
RESPONSE="$(curl -sS -w "\nHTTP_%{http_code}" -H "Authorization: Bearer $SECRET" "$ENDPOINT")"
BODY="$(echo "$RESPONSE" | sed '$d')"
STATUS="$(echo "$RESPONSE" | tail -1 | sed 's/HTTP_//')"

if [ "$STATUS" = "200" ]; then
  echo "✅ HTTP 200"
  if command -v jq >/dev/null 2>&1; then
    echo "$BODY" | jq .
  else
    echo "$BODY"
  fi
else
  echo "❌ HTTP $STATUS"
  echo "$BODY"
  exit 1
fi
