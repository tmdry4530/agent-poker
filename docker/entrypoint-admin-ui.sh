#!/bin/sh
# Runtime environment substitution for Next.js standalone output.
# NEXT_PUBLIC_* vars are inlined at build time. This script replaces
# build-time defaults with runtime values before starting the server.
set -e

# Only substitute if runtime values are provided
if [ -n "${NEXT_PUBLIC_LOBBY_API_URL}" ]; then
  echo "Substituting NEXT_PUBLIC_LOBBY_API_URL=${NEXT_PUBLIC_LOBBY_API_URL}"
  find /app/apps/admin-ui/.next -name '*.js' -exec \
    sed -i "s|http://localhost:8080|${NEXT_PUBLIC_LOBBY_API_URL}|g" {} + 2>/dev/null || true
fi

if [ -n "${NEXT_PUBLIC_GAME_SERVER_URL}" ]; then
  echo "Substituting NEXT_PUBLIC_GAME_SERVER_URL=${NEXT_PUBLIC_GAME_SERVER_URL}"
  find /app/apps/admin-ui/.next -name '*.js' -exec \
    sed -i "s|ws://localhost:8081|${NEXT_PUBLIC_GAME_SERVER_URL}|g" {} + 2>/dev/null || true
fi

if [ -n "${NEXT_PUBLIC_GAME_SERVER_WS_URL}" ]; then
  echo "Substituting NEXT_PUBLIC_GAME_SERVER_WS_URL=${NEXT_PUBLIC_GAME_SERVER_WS_URL}"
  find /app/apps/admin-ui/.next -name '*.js' -exec \
    sed -i "s|ws://localhost:8081|${NEXT_PUBLIC_GAME_SERVER_WS_URL}|g" {} + 2>/dev/null || true
fi

echo "Starting admin-ui..."
exec node apps/admin-ui/server.js
