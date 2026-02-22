#!/bin/sh
# Nginx entrypoint: use Let's Encrypt certs if available, else generate self-signed.
set -e

CERT_DIR="/etc/nginx/certs"
CERT_FILE="${CERT_DIR}/cert.pem"
KEY_FILE="${CERT_DIR}/key.pem"

LE_DIR="/etc/letsencrypt/live/api.clawpoker.live"
LE_CERT="${LE_DIR}/fullchain.pem"
LE_KEY="${LE_DIR}/privkey.pem"

# Prefer Let's Encrypt certificates if available
if [ -f "${LE_CERT}" ] && [ -f "${LE_KEY}" ]; then
  echo "Let's Encrypt certificates found. Symlinking..."
  mkdir -p "${CERT_DIR}"
  ln -sf "${LE_CERT}" "${CERT_FILE}"
  ln -sf "${LE_KEY}" "${KEY_FILE}"
  echo "Using Let's Encrypt certificates."
elif [ ! -f "${CERT_FILE}" ] || [ ! -f "${KEY_FILE}" ]; then
  echo "No TLS certificates found. Generating self-signed certificate for initial boot..."
  mkdir -p "${CERT_DIR}"
  apk add --no-cache openssl > /dev/null 2>&1 || true
  openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "${KEY_FILE}" \
    -out "${CERT_FILE}" \
    -subj "/C=US/ST=Dev/L=Local/O=AgentPoker/CN=api.clawpoker.live" \
    -addext "subjectAltName=DNS:api.clawpoker.live,DNS:localhost,IP:127.0.0.1" \
    2>/dev/null
  echo "Self-signed certificate generated (replace with Let's Encrypt for production)."
fi

echo "Starting nginx..."
exec nginx -g "daemon off;"
