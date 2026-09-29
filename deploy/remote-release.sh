#!/usr/bin/env bash
# Runs ON the EC2 host (piped in over SSH by the GitHub Actions deploy job).
# Promotes the freshly-uploaded release in releases/next, updates the database
# schema, restarts the service and rolls back if the health check fails.
set -euo pipefail

SERVICE=health-partner-service
ROOT=/opt/$SERVICE
ENV_FILE="$ROOT/shared/$SERVICE.env"
KEEP=5

[ -f "$ENV_FILE" ] || { echo "missing $ENV_FILE - run deploy/setup-ec2.sh first"; exit 1; }
[ -d "$ROOT/releases/next" ] || { echo "no uploaded release at $ROOT/releases/next"; exit 1; }

TS=$(date +%Y%m%d%H%M%S)
REL="$ROOT/releases/$TS"
PREVIOUS=$(readlink -f "$ROOT/current" 2>/dev/null || true)

mv "$ROOT/releases/next" "$REL"
cd "$REL"

# DATABASE_URL etc. for the schema step below.
set -a; . "$ENV_FILE"; set +a
export NODE_ENV=production
PORT=${PORT:-3000}

echo "==> installing production dependencies"
npm ci --omit=dev

echo "==> updating database schema (idempotent)"
node dist/config/init-db.js

echo "==> switching 'current' symlink -> $TS"
ln -sfn "$REL" "$ROOT/current"

echo "==> restarting service"
sudo systemctl restart "$SERVICE"

echo "==> health check on port $PORT"
if ! curl -fsS --retry 10 --retry-delay 2 --retry-connrefused "http://127.0.0.1:$PORT/health"; then
  echo
  echo "!! health check failed"
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    echo "!! rolling back to $(basename "$PREVIOUS")"
    ln -sfn "$PREVIOUS" "$ROOT/current"
    sudo systemctl restart "$SERVICE"
  fi
  exit 1
fi
echo

echo "==> pruning old releases (keeping last $KEEP)"
ls -1dt "$ROOT"/releases/*/ | tail -n +$((KEEP + 1)) | xargs -r rm -rf

echo "==> deployed $TS"
