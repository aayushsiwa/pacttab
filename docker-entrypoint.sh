#!/bin/sh
set -e

echo "==> [PactTab] Initializing container runtime..."

if [ -n "$DATABASE_URL" ]; then
  echo "==> [PactTab] Running database initialization and migrations..."
  MAX_RETRIES=15
  COUNT=0
  until pnpm run db:init || [ $COUNT -ge $MAX_RETRIES ]; do
    COUNT=$((COUNT + 1))
    echo "    Waiting for PostgreSQL readiness ($COUNT/$MAX_RETRIES)..."
    sleep 3
  done

  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo "==> [PactTab Error] Could not connect to database after $MAX_RETRIES attempts."
    exit 1
  fi
fi

echo "==> [PactTab] Launching application server..."
exec "$@"
