#!/bin/sh
# Nginx entrypoint: generate self-signed certs if none provided, then start nginx.
set -e

CERT_DIR="/etc/nginx/certs"
CERT_FILE="${CERT_DIR}/cert.pem"
KEY_FILE="${CERT_DIR}/key.pem"

if [ ! -f "${CERT_FILE}" ] || [ ! -f "${KEY_FILE}" ]; then
  echo "No TLS certificates found. Generating self-signed certificate for development..."
  mkdir -p "${CERT_DIR}"
  apk add --no-cache openssl > /dev/null 2>&1 || true
  openssl req -x509 -nodes -days 365 \
    -newkey rsa:2048 \
    -keyout "${KEY_FILE}" \
    -out "${CERT_FILE}" \
    -subj "/C=US/ST=Dev/L=Local/O=AgentPoker/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
    2>/dev/null
  echo "Self-signed certificate generated."
fi

echo "Starting nginx..."
exec nginx -g "daemon off;"
