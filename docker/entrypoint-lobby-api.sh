#!/bin/sh
# Lobby-API entrypoint: verify DB connectivity, run migrations, then start server.
set -e

echo "Checking database connection..."
MAX_RETRIES=3
RETRY_INTERVAL=5
for i in $(seq 1 $MAX_RETRIES); do
  if node -e "
    const url = new URL(process.env.DATABASE_URL.replace(/^postgres(ql)?:\/\//, 'http://'));
    const net = require('net');
    const s = net.connect({ port: Number(url.port) || 5432, host: url.hostname, family: 4 }, () => { s.end(); process.exit(0); });
    s.on('error', () => process.exit(1));
    setTimeout(() => process.exit(1), 5000);
  " 2>/dev/null; then
    echo "Database connection established."
    break
  fi
  if [ "$i" = "$MAX_RETRIES" ]; then
    echo "ERROR: Could not connect to database after ${MAX_RETRIES} attempts."
    exit 1
  fi
  echo "Waiting for database... (attempt $i/$MAX_RETRIES)"
  sleep $RETRY_INTERVAL
done

# Run drizzle migrations if migration files exist
if [ -d "/app/drizzle" ] && [ "$(ls -A /app/drizzle/*.sql 2>/dev/null)" ]; then
  echo "Running database migrations..."
  npx drizzle-kit migrate 2>&1
  echo "Migrations complete."
else
  echo "No migration files found, skipping migrations."
fi

echo "Starting lobby-api..."
exec node dist/index.js
