#!/usr/bin/env bash
# Deploy script for agent-poker production stack.
#
# Usage:
#   ./scripts/deploy.sh              # Full deploy (pre-flight + build + up)
#   ./scripts/deploy.sh --check      # Pre-flight checks only
#   ./scripts/deploy.sh --no-build   # Skip Docker image builds
#
# Expects a .env file in the project root (or environment variables set).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker-compose.prod.yml"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err()  { echo -e "${RED}[ERROR]${NC} $1"; }

ERRORS=0
SKIP_BUILD=false
CHECK_ONLY=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --check)     CHECK_ONLY=true; shift ;;
    --no-build)  SKIP_BUILD=true; shift ;;
    --help)
      echo "Usage: $0 [--check] [--no-build]"
      echo "  --check     Run pre-flight checks only"
      echo "  --no-build  Skip Docker image builds"
      exit 0
      ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "========================================="
echo "  agent-poker deploy"
echo "========================================="
echo ""

# ── Pre-flight checks ──────────────────────

echo "Running pre-flight checks..."
echo ""

# 1. Docker
if command -v docker &>/dev/null; then
  DOCKER_VERSION=$(docker version --format '{{.Server.Version}}' 2>/dev/null || echo "unknown")
  log_ok "Docker installed: v${DOCKER_VERSION}"
else
  log_err "Docker not found. Install Docker first."
  ERRORS=$((ERRORS + 1))
fi

# 2. Docker Compose
if docker compose version &>/dev/null; then
  COMPOSE_VERSION=$(docker compose version --short 2>/dev/null || echo "unknown")
  log_ok "Docker Compose: v${COMPOSE_VERSION}"
else
  log_err "Docker Compose not found."
  ERRORS=$((ERRORS + 1))
fi

# 3. Compose file exists
if [ -f "${COMPOSE_FILE}" ]; then
  log_ok "Compose file: ${COMPOSE_FILE}"
else
  log_err "Compose file not found: ${COMPOSE_FILE}"
  ERRORS=$((ERRORS + 1))
fi

# 4. Required environment variables
REQUIRED_VARS=("DATABASE_URL" "SEAT_TOKEN_SECRET" "AUTH_JWT_SECRET")
for var in "${REQUIRED_VARS[@]}"; do
  if [ -n "${!var:-}" ]; then
    log_ok "Env var ${var}: set"
  elif [ -f "${PROJECT_DIR}/.env" ] && grep -q "^${var}=" "${PROJECT_DIR}/.env" 2>/dev/null; then
    log_ok "Env var ${var}: set (in .env)"
  else
    log_err "Env var ${var}: NOT SET"
    ERRORS=$((ERRORS + 1))
  fi
done

# 5. Disk space (warn if < 5GB free)
FREE_SPACE_KB=$(df "${PROJECT_DIR}" --output=avail 2>/dev/null | tail -1 | tr -d ' ')
if [ -n "${FREE_SPACE_KB}" ]; then
  FREE_SPACE_GB=$((FREE_SPACE_KB / 1024 / 1024))
  if [ "${FREE_SPACE_GB}" -lt 5 ]; then
    log_warn "Low disk space: ${FREE_SPACE_GB}GB free (recommend 5GB+)"
  else
    log_ok "Disk space: ${FREE_SPACE_GB}GB free"
  fi
fi

# 6. TLS certificates (Let's Encrypt or self-signed)
LE_CERT="/etc/letsencrypt/live/api.clawpoker.live/fullchain.pem"
if [ -f "${LE_CERT}" ]; then
  log_ok "TLS certificates: Let's Encrypt found"
elif [ -d "${PROJECT_DIR}/nginx/certs" ] && [ -f "${PROJECT_DIR}/nginx/certs/cert.pem" ]; then
  log_ok "TLS certificates: local certs found"
else
  log_warn "TLS certificates: not found (self-signed will be auto-generated)"
fi

# 7. Port availability
for PORT in 80 443; do
  if ss -tlnp 2>/dev/null | grep -q ":${PORT} " || netstat -tlnp 2>/dev/null | grep -q ":${PORT} "; then
    log_warn "Port ${PORT} already in use"
  else
    log_ok "Port ${PORT}: available"
  fi
done

echo ""

if [ "${ERRORS}" -gt 0 ]; then
  log_err "${ERRORS} pre-flight check(s) failed. Fix issues above before deploying."
  exit 1
fi

log_ok "All pre-flight checks passed."

if [ "${CHECK_ONLY}" = true ]; then
  exit 0
fi

echo ""

# ── Certbot (first-time only) ─────────────

DOMAIN="${DOMAIN:-api.clawpoker.live}"
CERTBOT_WEBROOT="/var/www/certbot"

if [ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] && command -v certbot &>/dev/null; then
  echo "No Let's Encrypt certificate found for ${DOMAIN}."
  echo "Run certbot after nginx starts:"
  echo "  sudo certbot certonly --webroot -w ${CERTBOT_WEBROOT} -d ${DOMAIN} --non-interactive --agree-tos -m <your-email>"
  echo "  docker compose -f ${COMPOSE_FILE} restart nginx"
  echo ""
fi

# ── Deploy ──────────────────────────────────

# Load .env if present
if [ -f "${PROJECT_DIR}/.env" ]; then
  echo "Loading .env file..."
  set -a
  source "${PROJECT_DIR}/.env"
  set +a
fi

# Build images
if [ "${SKIP_BUILD}" = false ]; then
  echo "Building Docker images..."
  docker compose -f "${COMPOSE_FILE}" build
  echo ""
fi

# Deploy
echo "Starting services..."
docker compose -f "${COMPOSE_FILE}" up -d

echo ""
echo "Waiting for health checks..."
sleep 10

# Check service status
UNHEALTHY=0

for SVC in nginx lobby-api game-server; do
  STATUS=$(docker inspect --format='{{.State.Health.Status}}' "agent-poker-${SVC}" 2>/dev/null || echo "not_found")
  case "${STATUS}" in
    healthy)   log_ok "${SVC}: healthy" ;;
    starting)  log_warn "${SVC}: starting (still initializing)" ;;
    *)         log_err "${SVC}: ${STATUS}"; UNHEALTHY=$((UNHEALTHY + 1)) ;;
  esac
done

echo ""

if [ "${UNHEALTHY}" -gt 0 ]; then
  log_warn "Some services are not healthy yet. Check: docker compose -f docker-compose.prod.yml logs"
else
  log_ok "All services healthy. Deployment complete."
fi

echo ""
echo "  Endpoints:"
echo "    HTTPS:     https://api.clawpoker.live"
echo "    API:       https://api.clawpoker.live/api/"
echo "    WebSocket: wss://api.clawpoker.live/ws"
echo "    Health:    https://api.clawpoker.live/healthz"
echo ""
